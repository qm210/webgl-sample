import {useEffect, useState} from "preact/hooks";
import baseShader from "../shaders/raytracing.glsl";
import {useLocation, useRoute} from "preact-iso";

import "ace-builds/src-noconflict/mode-glsl";
import "ace-builds/src-noconflict/ext-language_tools"
import {shaderKeyBase} from "../app/globals.js";
import {MainLayout} from "./MainLayout.jsx";


export const ShaderLoader = () => {
    const [state, setState] = useState({
        initShader: "",
        isLoading: true,
        shaderKey: "",
        error: "",
        wasStored: false
    });
    const route = useRoute();
    const location = useLocation();

    useEffect(() => {
        const loadShader = async (name) => {
            const result = {
                initShader: baseShader,
                shaderKey: shaderKeyBase,
            };
            if (!name) {
                return result;
            }
            try {
                const module = await import(`../shaders/${name}.glsl`);
                result.initShader = module.default || module;
                result.shaderKey = [shaderKeyBase, name].join('.');
            } catch (error) {
                console.error("Cannot load shader with name:", name, error);
                result.error = error;
            }
            return result;
        }

        loadShader(route.params.shaderId)
            .then((result) => {
                if (result.error) {
                    location.route('/');
                    return;
                }
                const storedVersion = localStorage.getItem(result.shaderKey);
                if (storedVersion) {
                    result.initShader = storedVersion;
                }
                setState(state => ({
                    ...state,
                    ...result,
                    isLoading: false,
                    wasStored: !!storedVersion,
                }));
            });
    }, [route.params, location]);

    if (state.isLoading) {
        return (
            <div className={"loading wave"}>
                <h2 className={"wave resize-wave"} style={{"--amplitude": "1rem", "--factor": 0.7}}>Hähähä.</h2>
                <h4 className={"resize-wave"}>Habs gleich.</h4>
            </div>
        );
    }

    return (
        <MainLayout
            initialShader={state.initShader}
            storageKey={state.shaderKey}
        />
    );
};

