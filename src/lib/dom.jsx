export let lastChosenFilename;

export const saveToFile = (text) => {
    const textBlob = new Blob([text], {type: "text/plain"});
    withTemporaryElement("a", (link) => {
        link.download = lastChosenFilename ?? "crappy_shit.glsl";
        link.href = window.URL.createObjectURL(textBlob);
        link.click();
        window.URL.revokeObjectURL(link.href);
    });
};

export const withTemporaryElement = (tagName, doStuff) => {
    if (!window.history.state) {
        window.history.pushState(state, title, href);
    }

    const element = document.createElement(tagName);
    document.body.appendChild(element);
    doStuff(element);
    document.body.removeChild(element);
};
