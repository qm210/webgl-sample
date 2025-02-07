import './app.css';
import {FirstSample} from "./pages/FirstSample.jsx";
import {ErrorBoundary, LocationProvider, Route, Router} from "preact-iso";
import {MainApp} from "./pages/MainApp.jsx";

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
                    component={MainApp}
                />
                <MainApp default/>
            </Router>
        </ErrorBoundary>
    </LocationProvider>
);
