import AceEditor from "react-ace";
import {fontSize} from "../app/globals.js";
import {signal} from "@preact/signals";
import {currentMethod, options} from "./MainLayout.jsx";

const aceRef = signal(null);
export const ace = () => aceRef.value?.editor;

export const ShaderEditor = ({
    value,
    onChange,
    error,
    onApply,
    onStop,
    onReset,
    onToggleStorage,
    onSaveToFile,
    analyzed
}) => {

    const onCursorChange = () => {
        const startIndex = ace().getSelectionRange().start.row;
        const method = analyzed.methods.find(m => startIndex >= m.lineIndex && startIndex <= m.lineCloseIndex);
        currentMethod.value = method ?? null;
    };

    return (
        <div className={"editor-container"}>
            <div className={"editor-frame"}>
                <AceEditor
                    ref={(ref) => {
                        if (ref) {
                            aceRef.value = ref;
                        }
                    }}
                    mode={"glsl"}
                    value={value}
                    onChange={onChange}
                    name={"ACE_ID"}
                    annotations={
                        error.errors.map(error => ({
                            row: error.row,
                            column: error.column,
                            type: "error",
                            text: error.message
                        }))
                    }
                    editorProps={{
                        $blockScrolling: true,
                    }}
                    fontSize={fontSize}
                    style={{
                        lineHeight: "120%",
                        width: "100%",
                        height: "100%",
                        backgroundColor: options.value.noStorage ? "#decefa70" : "white",
                    }}
                    setOptions={{
                        showLineNumbers: true,
                        enableBasicAutocompletion: true,
                        enableLiveAutocompletion: true,
                        enableMobileMenu: true,
                    }}
                    onCursorChange={onCursorChange}
                />
            </div>
            <div className={"flex-row"} style={{marginTop: "0.5rem"}}>
                <button
                    onClick={onApply}
                >
                    Apply Shader
                </button>
                <button
                    onClick={onStop}
                >
                    Stop
                </button>
                <div className={"flex-row boxed"}>
                    <button
                        onClick={onReset}
                        disabled={options.value.noStorage}
                    >
                        Reset to Sample
                    </button>
                    <span className={"flex-row"}>
                        <input
                            type="checkbox"
                            id="noStore"
                            checked={!!options.value.noStorage}
                            onChange={onToggleStorage}
                        />
                        <label htmlFor={"noStore"}>
                            Disable Storage
                        </label>
                    </span>
                </div>
                <button
                    onClick={onSaveToFile}
                >
                    Save Textfile (the running one)
                </button>
            </div>
        </div>
    );
};