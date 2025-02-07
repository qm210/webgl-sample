import {MainLayout} from "./MainApp.jsx";
import someShader from "../shaders/sample.glsl";

const storageKey = "qm.shader.first";
const initialShader = localStorage.getItem(storageKey) ?? someShader.trim();

export const FirstSample = () => {

    return (
        <MainLayout
            initialShader={initialShader}
            storageKey={"qm.shader.first"}
        />
    );
};
