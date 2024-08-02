import React, { useState, useRef, useEffect, useCallback } from 'react';
import Editor, { useMonaco } from "@monaco-editor/react";
import './VSCodeEditor.css';

// Error Boundary component
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Error caught by ErrorBoundary:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return <h1>Something went wrong. Please check the console for more information.</h1>;
        }

        return this.props.children;
    }
}

const VSCodeWebEditor = () => {
    // State declarations
    const [activeFile, setActiveFile] = useState('index.html');
    const [files, setFiles] = useState(() => {
        const savedFiles = localStorage.getItem('editor_files');
        return savedFiles ? JSON.parse(savedFiles) : {
            'index.html': '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Document</title>\n  <link rel="stylesheet" href="styles.css">\n</head>\n<body>\n  <h1>Hello, World!</h1>\n  <script src="script.js"></script>\n</body>\n</html>',
            'styles.css': 'body {\n  font-family: Arial, sans-serif;\n  margin: 0;\n  padding: 20px;\n  background-color: #f0f0f0;\n}\n\nh1 {\n  color: #333;\n  text-align: center;\n}',
            'script.js': 'document.addEventListener("DOMContentLoaded", () => {\n  const heading = document.querySelector("h1");\n  heading.addEventListener("click", () => {\n    alert("You clicked the heading!");\n    const name = prompt("What\'s your name?");\n    if (name) {\n      console.log(`Hello, ${name}!`);\n    }\n  });\n});'
        };
    });
    const [output, setOutput] = useState('');
    const [showConsole, setShowConsole] = useState(false);
    const [sidebarWidth, setSidebarWidth] = useState(() => {
        const savedWidth = localStorage.getItem('sidebar_width');
        return savedWidth ? parseInt(savedWidth, 10) : 200;
    });
    const [outputHeight, setOutputHeight] = useState(() => {
        const savedHeight = localStorage.getItem('output_height');
        return savedHeight ? parseInt(savedHeight, 10) : 200;
    });
    const [autoRun, setAutoRun] = useState(() => {
        const savedAutoRun = localStorage.getItem('auto_run');
        return savedAutoRun ? JSON.parse(savedAutoRun) : true;
    });
    const [showAlert, setShowAlert] = useState(false);
    const [alertMessage, setAlertMessage] = useState('');
    const [showPrompt, setShowPrompt] = useState(false);
    const [promptMessage, setPromptMessage] = useState('');
    const [promptResponse, setPromptResponse] = useState('');
    const [promptResolve, setPromptResolve] = useState(null);
    const [editableFiles] = useState(['index.html', 'styles.css', 'script.js']);

    // Refs
    const monaco = useMonaco();
    const iframeRef = useRef(null);
    const editorRef = useRef(null);
    const fileInputRef = useRef(null);

    // Effects for local storage
    useEffect(() => {
        localStorage.setItem('editor_files', JSON.stringify(files));
    }, [files]);

    useEffect(() => {
        localStorage.setItem('sidebar_width', sidebarWidth.toString());
    }, [sidebarWidth]);

    useEffect(() => {
        localStorage.setItem('output_height', outputHeight.toString());
    }, [outputHeight]);

    useEffect(() => {
        localStorage.setItem('auto_run', JSON.stringify(autoRun));
    }, [autoRun]);

    // File operations
    const updateFile = useCallback((filename, content) => {
        setFiles(prev => ({ ...prev, [filename]: content }));
    }, []);

    const addFile = useCallback((filename, content) => {
        setFiles(prev => ({ ...prev, [filename]: content }));
        setActiveFile(filename);
    }, []);

    const closeFile = useCallback((filename) => {
        if (editableFiles.includes(filename)) {
            console.log("Cannot close editable file:", filename);
            return;
        }
        setFiles(prev => {
            const newFiles = { ...prev };
            delete newFiles[filename];
            return newFiles;
        });
        if (activeFile === filename) {
            setActiveFile(Object.keys(files).filter(f => f !== filename)[0]);
        }
    }, [files, activeFile, editableFiles]);

    // Code execution
    const runCode = useCallback(() => {
        try {
            const htmlContent = files['index.html'];
            const cssContent = files['styles.css'];
            const jsContent = files['script.js'];

            const fullContent = `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Output</title>
                    <style>${cssContent}</style>
                </head>
                <body>
                    ${htmlContent}
                    <script>
                    (function() {
                        var oldLog = console.log;
                        console.log = function(...args) {
                            oldLog.apply(console, args);
                            window.parent.postMessage({type: 'console', message: args.join(' ')}, '*');
                        };

                        window.alert = function(message) {
                            window.parent.postMessage({type: 'alert', message: message}, '*');
                            return new Promise(resolve => setTimeout(resolve, 0));
                        };

                        window.prompt = function(message) {
                            return new Promise(resolve => {
                                window.parent.postMessage({type: 'prompt', message: message}, '*');
                                window.addEventListener('message', function promptListener(event) {
                                    if (event.data.type === 'promptResponse') {
                                        window.removeEventListener('message', promptListener);
                                        resolve(event.data.response);
                                    }
                                });
                            });
                        };

                        window.onerror = function(message, source, lineno, colno, error) {
                            window.parent.postMessage({type: 'error', message: message}, '*');
                        };
                    })();

                    ${jsContent}
                    </script>
                </body>
                </html>
            `;

            if (iframeRef.current) {
                iframeRef.current.srcdoc = fullContent;
            } else {
                console.error("iframeRef is not available");
            }

            setOutput('');
        } catch (error) {
            console.error("Error in runCode:", error);
        }
    }, [files]);

    // Event handlers
    useEffect(() => {
        const handleMessage = (event) => {
            switch (event.data.type) {
                case 'console':
                case 'error':
                    setOutput(prev => prev + event.data.message + '\n');
                    break;
                case 'alert':
                    setAlertMessage(event.data.message);
                    setShowAlert(true);
                    break;
                case 'prompt':
                    setPromptMessage(event.data.message);
                    setShowPrompt(true);
                    setPromptResolve(() => (response) => {
                        if (iframeRef.current && iframeRef.current.contentWindow) {
                            iframeRef.current.contentWindow.postMessage({type: 'promptResponse', response: response}, '*');
                        }
                    });
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('message', handleMessage);

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    useEffect(() => {
        if (autoRun) {
            const timeoutId = setTimeout(() => {
                runCode();
            }, 1000);

            return () => clearTimeout(timeoutId);
        }
    }, [files, runCode, autoRun]);

    const handleSidebarResize = useCallback((e) => {
        const newWidth = e.clientX;
        setSidebarWidth(newWidth);
    }, []);

    const handleOutputResize = useCallback((e) => {
        const newHeight = window.innerHeight - e.clientY;
        setOutputHeight(newHeight);
    }, []);

    useEffect(() => {
        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleSidebarResize);
            document.removeEventListener('mousemove', handleOutputResize);
        };

        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleSidebarResize, handleOutputResize]);

    // Monaco editor setup
    useEffect(() => {
        if (monaco) {
            monaco.languages.registerCompletionItemProvider('javascript', {
                provideCompletionItems: (model, position) => {
                    const word = model.getWordUntilPosition(position);
                    const range = {
                        startLineNumber: position.lineNumber,
                        endLineNumber: position.lineNumber,
                        startColumn: word.startColumn,
                        endColumn: word.endColumn
                    };
                    return {
                        suggestions: [
                            {
                                label: 'addEventListener',
                                kind: monaco.languages.CompletionItemKind.Function,
                                documentation: 'Attaches an event handler to the specified element',
                                insertText: 'addEventListener(\'${1:event}\', (${2:event}) => {\n\t${0}\n})',
                                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                range: range
                            },
                            {
                                label: 'querySelector',
                                kind: monaco.languages.CompletionItemKind.Function,
                                documentation: 'Returns the first element that matches a specified CSS selector(s) in the document',
                                insertText: 'querySelector(\'${1:selector}\')',
                                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                range: range
                            },
                            {
                                label: 'console.log',
                                kind: monaco.languages.CompletionItemKind.Function,
                                documentation: 'Outputs a message to the web console',
                                insertText: 'console.log(${1:message})',
                                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                range: range
                            },
                            {
                                label: 'function',
                                kind: monaco.languages.CompletionItemKind.Snippet,
                                documentation: 'Function declaration',
                                insertText: 'function ${1:name}(${2:params}) {\n\t${0}\n}',
                                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                range: range
                            },
                            {
                                label: 'arrow',
                                kind: monaco.languages.CompletionItemKind.Snippet,
                                documentation: 'Arrow function',
                                insertText: '(${1:params}) => {\n\t${0}\n}',
                                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                range: range
                            },
                        ]
                    };
                }
            });
        }
    }, [monaco]);

    const handleEditorDidMount = (editor, monaco) => {
        editorRef.current = editor;

        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
            console.log('File saved');
            // You can add additional save functionality here if needed
        });

        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
            editor.getAction('actions.find').run();
        });

        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => {
            editor.getAction('editor.action.formatDocument').run();
        });
    };

    const getLanguage = (filename) => {
        const extension = filename.split('.').pop();
        switch (extension) {
            case 'js': return 'javascript';
            case 'css': return 'css';
            case 'html': return 'html';
            default: return 'plaintext';
        }
    };

    const editorOptions = {
        minimap: { enabled: false },
        fontSize: 14,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on',
        formatOnType: true,
        formatOnPaste: true,
        suggestOnTriggerCharacters: true,
        acceptSuggestionOnEnter: 'on',
    };

    const toggleConsole = () => setShowConsole(prev => !prev);
    const toggleAutoRun = () => setAutoRun(prev => !prev);
    const handleAlertOk = () => setShowAlert(false);

    const handlePromptSubmit = () => {
        setShowPrompt(false);
        if (promptResolve) {
            promptResolve(promptResponse);
            setPromptResolve(null);
        }
    };

    const handleDownload = (filename) => {
        const content = files[filename];
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleUpload = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                addFile(file.name, content);
            };
            reader.readAsText(file);
        }
    };

    const triggerFileUpload = () => fileInputRef.current.click();

    // Clean code function
    const cleanCode = () => {
        // Clear the content of index.html, styles.css, and script.js
        updateFile('index.html', '');
        updateFile('styles.css', '');
        updateFile('script.js', '');
    };

    return (
        <ErrorBoundary>
            <div className="vscode-editor">
                <div className="top-bar">
                    <div className="logo">
                        <span role="img" aria-label="code">⚡</span>
                        <span>Binary Beats</span>
                    </div>
                    <div className="actions">
                        <button onClick={toggleAutoRun} className={`action-button ${autoRun ? 'active' : ''}`}>
                            {autoRun ? '🔄 Auto' : '🔁 Manual'}
                        </button>
                        <button onClick={runCode} className="action-button">▶️ Run</button>
                        <button onClick={() => handleDownload(activeFile)} className="action-button">⬇️ Download</button>
                        <button onClick={triggerFileUpload} className="action-button">⬆️ Upload</button>
                        <button onClick={cleanCode} className="action-button">🧹 Clean Code</button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            onChange={handleUpload}
                            accept=".html,.css,.js,.svg,.txt"
                        />
                        <button className="action-button">⚙️</button>
                    </div>
                </div>
                <div className="main-container">
                    <div className="sidebar" style={{ width: `${sidebarWidth}px` }}>
                        <div className="sidebar-header">EXPLORER</div>
                        <div className="file-explorer">
                            <div className="folder">
                                <span role="img" aria-label="folder">📁</span>
                                <span>project</span>
                            </div>
                            {Object.keys(files).map(filename => (
                                <div key={filename} className="file-item">
                                    <div
                                        className={`file ${activeFile === filename ? 'active' : ''}`}
                                        onClick={() => setActiveFile(filename)}
                                    >
                                        <span role="img" aria-label="file">📄</span>
                                        <span>{filename}</span>
                                    </div>
                                    {!editableFiles.includes(filename) && (
                                        <button
                                            className="close-button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                closeFile(filename);
                                            }}
                                            aria-label={`Close ${filename}`}
                                        >
                                            ✖️
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div
                        className="resizer vertical-resizer"
                        onMouseDown={() => document.addEventListener('mousemove', handleSidebarResize)}
                    ></div>
                    <div className="main-content">
                        <div className="tabs">
                            {Object.keys(files).map(filename => (
                                <div
                                    key={filename}
                                    className={`tab ${activeFile === filename ? 'active' : ''}`}
                                    onClick={() => setActiveFile(filename)}
                                >
                                    {filename}
                                    {!editableFiles.includes(filename) && (
                                        <button
                                            className="close-tab"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                closeFile(filename);
                                            }}
                                            aria-label={`Close ${filename}`}
                                        >
                                            ✖️
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="editor-container">
                            <Editor
                                height="100%"
                                language={getLanguage(activeFile)}
                                value={files[activeFile]}
                                onChange={(value) => updateFile(activeFile, value)}
                                theme="vs-dark"
                                options={{
                                    ...editorOptions,
                                    readOnly: !editableFiles.includes(activeFile)
                                }}
                                onMount={handleEditorDidMount}
                            />
                        </div>
                        <div
                            className="resizer horizontal-resizer"
                            onMouseDown={() => document.addEventListener('mousemove', handleOutputResize)}
                        ></div>
                        <div className="output-container" style={{ height: `${outputHeight}px` }}>
                            <div className="output-header">
                                <span>Output</span>
                                <div>
                                    <button onClick={toggleConsole} className="console-toggle">
                                        🖥️
                                    </button>
                                </div>
                            </div>
                            <div className="output-content">
                                <iframe ref={iframeRef} title="output" sandbox="allow-scripts"></iframe>
                                {showConsole && (
                                    <div className="console-output">
                                        <pre>{output}</pre>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                {showAlert && (
                    <div className="modal">
                        <div className="modal-content">
                            <p>{alertMessage}</p>
                            <button onClick={handleAlertOk}>OK</button>
                        </div>
                    </div>
                )}
                {showPrompt && (
                    <div className="modal">
                        <div className="modal-content">
                            <p>{promptMessage}</p>
                            <input
                                type="text"
                                value={promptResponse}
                                onChange={(e) => setPromptResponse(e.target.value)}
                            />
                            <button onClick={handlePromptSubmit}>OK</button>
                        </div>
                    </div>
                )}
            </div>
        </ErrorBoundary>
    );
};

export default VSCodeWebEditor;
