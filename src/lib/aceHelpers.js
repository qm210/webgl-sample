import {ace} from "../components/ShaderEditor.jsx";

export const handleLineJump = (lineIndex, column = 0) => {
    const editor = ace();
    if (!editor) {
        return () => {
            alert("AceEditor Ref broken.");
        };
    }
    return () => {
        editor.scrollToLine(lineIndex + 1, true, true);
        editor.gotoLine(lineIndex + 1, column, true);
    };
};

export const jumpToError = (error) => {
    handleLineJump(error.row, error.column)();
};
