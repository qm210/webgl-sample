import someShader from "../../shaders/sample.glsl";
import {MainLayout} from "../MainLayout.jsx";

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
