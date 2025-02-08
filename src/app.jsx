import './app.css';
import {FirstSample} from "./components/deprecated/FirstSample.jsx";
import {ErrorBoundary, LocationProvider, Route, Router} from "preact-iso";
import {ShaderLoader} from "./components/ShaderLoader.jsx";

export const App = () => (
    <LocationProvider>
        <ErrorBoundary>
            <Router>
                <Route
                    path={"/first"}
                    component={FirstSample}
                />
                <Route
                    path={"/:shaderId"}
                    component={ShaderLoader}
                />
                <ShaderLoader default/>
            </Router>
        </ErrorBoundary>
    </LocationProvider>
);
