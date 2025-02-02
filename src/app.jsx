import './app.css';
import {FirstSample} from "./pages/FirstSample.jsx";
import {ErrorBoundary, LocationProvider, Route, Router} from "preact-iso";
import {MainLayout} from "./pages/MainLayout.jsx";

export const App = () => (
    <LocationProvider>
        <ErrorBoundary>
            <Router>
                <Route
                    path={"/first"}
                    component={FirstSample}
                />
                <MainLayout default/>
            </Router>
        </ErrorBoundary>
    </LocationProvider>
);
