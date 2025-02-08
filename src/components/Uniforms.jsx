import {useState} from "preact/hooks";
import {fontSize} from "../app/globals.js";


export const Uniforms = ({uniforms, loopSec, setLoopSec, time}) => {
    const [loopInput, setLoopInput] = useState(loopSec?.toString() ?? "");

    const resolution = !uniforms.iResolution
        ? "--"
        : `(${uniforms.iResolution[0].toFixed(0)} x ${uniforms.iResolution[1].toFixed(0)})`;

    const onChangeLoopInput = (event) => {
        const value = event.target.value;
        if (value === "") {
            setLoopInput(null);
            return;
        }
        const number = +value;
        if (!Number.isNaN(number)) {
            setLoopInput(value);
            setLoopSec(number);
        }
    }

    return (
        <div style={{
            fontSize,
            textAlign: "left",
            fontFamily: "monospace",
            marginLeft: "0.5rem",
        }}>
            <span>
                <label htmlFor={"inputLoopSec"}>
                    Loop:
                </label>
                <input
                    value={loopInput}
                    onChange={onChangeLoopInput}
                    id={"inputLoopSec"}
                    style={{
                        width: "3rem",
                        marginRight: 4,
                    }}
                />
                <label htmlFor={"inputLoopSec"}>
                    sec,{" "}
                </label>
            </span>
            <span>
                iTime = {time.toFixed(3)} sec, iResolution = {resolution}
            </span>
        </div>
    );
};