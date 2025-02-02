import {useEffect} from "preact/hooks";

export const useGlobalKeyPresses = (actions) => {
    useEffect(() => {
        const handle = (event) => {
            for (const action of actions) {
                const match =
                    event.key === action.key &&
                    !!action.shiftKey === !!event.shiftKey &&
                    !!action.ctrlKey === !!event.ctrlKey &&
                    !!action.altKey === !!event.altKey;
                if (match) {
                    action.handle();
                }
            }
        };
        window.addEventListener('keyup', handle);
        return () => {
            window.removeEventListener('keyup', handle);
        }
    }, [actions]);
};
