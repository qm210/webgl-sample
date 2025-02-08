import {useSignal} from "@preact/signals";
import {handleLineJump, jumpToError} from "../lib/aceHelpers.js";
import {useEffect} from "preact/hooks";

export const ErrorList = ({errors}) => {
    const hover = useSignal(null);

    useEffect(() => {
        if (errors.length > 0) {
            jumpToError(errors[0]);
        }
    }, [errors]);

    return (
        <div className={"error-grid"}>
            {
                errors.map((e, i) =>
                    <ErrorLine
                        key={i}
                        error={e}
                        index={i}
                        hover={hover}
                    />
                )
            }
        </div>
    );
};

const ErrorLine = ({error, index, hover}) => {
    const handlers = {
        onClick: () => {
            console.log(error);
            jumpToError(error);
        },
        onMouseEnter: () => {
            hover.value = index
        },
        onMouseLeave: () => {
            hover.value = null
        },
    };

    const style = {
        backgroundColor: hover.value === index ? '#ffff0044' : undefined,
    };

    return (
        <>
            <div {...handlers} style={style}>
                l.{error.row}:
            </div>
            <div {...handlers} style={style}>
                {error.message}
            </div>
        </>
    );
};
