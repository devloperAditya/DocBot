import { useState, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged, signOut, auth, User } from "./firebase";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Box,
} from "@mui/material";
import Loader from "./components/Loader";
import { Logout as LogoutIcon } from "@mui/icons-material";
import Login from "./routes/Login";
import Ingest from "./routes/Ingest";
import Chat from "./routes/Chat";
import { startSession } from "./lib/api";

// Module-level singleton to track session initialization
// This persists across React.StrictMode remounts and ensures only one API call
let sessionInitializationPromise: Promise<string> | null = null;

// Helper function to get or create session initialization promise
// This ensures atomicity - only one promise can exist at a time
function getOrCreateSessionPromise(): Promise<string> {
  // Final check - if sessionStorage already has a session, don't make API call
  const existingSessionId = sessionStorage.getItem("sessionId");
  if (existingSessionId) {
    console.log("[Session] Found session in storage before API call, returning:", existingSessionId);
    return Promise.resolve(existingSessionId);
  }

  if (sessionInitializationPromise) {
    console.log("[Session] Reusing existing promise");
    return sessionInitializationPromise;
  }

  // Create new promise immediately to ensure atomicity
  console.log("[Session] Creating new session initialization promise");
  sessionInitializationPromise = (async (): Promise<string> => {
    try {
      // Final check right before API call
      const checkAgain = sessionStorage.getItem("sessionId");
      if (checkAgain) {
        console.log("[Session] Session appeared in storage during initialization, using it:", checkAgain);
        sessionInitializationPromise = null;
        return checkAgain;
      }

      console.log("[Session] Starting new session initialization...", new Error().stack);
      const response = await startSession();
      sessionStorage.setItem("sessionId", response.sessionId);
      console.log("[Session] Session initialized:", response.sessionId);
      return response.sessionId;
    } catch (error) {
      console.error("[Session] Error starting session:", error);
      // Clear promise on error to allow retry
      sessionInitializationPromise = null;
      throw error;
    }
  })();

  return sessionInitializationPromise;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Check sessionStorage first to avoid unnecessary initialization
  const existingSessionId = sessionStorage.getItem("sessionId");
  const [sessionId, setSessionId] = useState<string | null>(existingSessionId);
  
  // Use ref to track if we've initiated session initialization in this component instance
  // This prevents multiple effects from the same component instance from triggering
  const initializationInitiatedRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      setUser(user);
      setLoading(false);
      // Clear sessionId when user logs out
      if (!user) {
        sessionStorage.removeItem("sessionId");
        setSessionId(null);
        // Reset module-level promise when user logs out
        sessionInitializationPromise = null;
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = () => {
    // Auth state change will be handled by onAuthStateChanged listener
    // No need to manually call anything here
  };

  const handleLogout = async () => {
    if (sessionId) {
      try {
        // End session before logout
        const { endSession } = await import("./lib/api");
        await endSession(sessionId);
      } catch (error) {
        console.error("Error ending session:", error);
      }
    }
    await signOut();
    sessionStorage.removeItem("sessionId");
    setSessionId(null);
    setUser(null);
    // Reset module-level promise on logout
    sessionInitializationPromise = null;
  };

  // Listen for storage changes and custom events to detect when a new session is created
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "sessionId" && e.newValue && e.newValue !== sessionId) {
        console.log("[Session] Detected new sessionId in storage:", e.newValue);
        setSessionId(e.newValue);
      }
    };

    const handleCustomStorageEvent = () => {
      // Check sessionStorage for new session
      const storedId = sessionStorage.getItem("sessionId");
      if (storedId && storedId !== sessionId) {
        console.log("[Session] Detected new sessionId via custom event:", storedId);
        setSessionId(storedId);
      }
    };

    // Listen for storage events (from other tabs/windows)
    window.addEventListener("storage", handleStorageChange);
    // Listen for custom events (from same tab)
    window.addEventListener("sessionStorage", handleCustomStorageEvent);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("sessionStorage", handleCustomStorageEvent);
    };
  }, [user, sessionId]);

  // Initialize session when user is logged in and no session exists
  useEffect(() => {
    // Early return if conditions aren't met
    if (!user) {
      console.log("[Session] No user, skipping initialization");
      return;
    }

    // Check current sessionId state - don't re-initialize if we already have one
    if (sessionId) {
      console.log("[Session] Session already exists:", sessionId);
      return;
    }

    // Check if we already have a session in sessionStorage (race condition guard)
    const existingId = sessionStorage.getItem("sessionId");
    if (existingId) {
      console.log("[Session] Found existing session in storage:", existingId);
      setSessionId(existingId);
      initializationInitiatedRef.current = false;
      return;
    }

    // Ref guard - prevent this effect from initiating multiple times
    if (initializationInitiatedRef.current) {
      console.log("[Session] Initialization already initiated by this component instance, skipping");
      return;
    }

    console.log("[Session] Effect triggered - initiating session initialization", new Error().stack);
    initializationInitiatedRef.current = true;

    // Use atomic helper to get or create session promise
    // This ensures only one API call happens, even with React.StrictMode double-mounting
    const promise = getOrCreateSessionPromise();
    
    // Set the session ID when promise resolves
    promise
      .then((id: string) => {
        console.log("[Session] Promise resolved, setting session ID:", id);
        setSessionId(id);
        initializationInitiatedRef.current = false;
      })
      .catch((error: unknown) => {
        console.error("[Session] Promise rejected:", error);
        initializationInitiatedRef.current = false;
        // Don't clear sessionId state on error - let user retry
      });

    // Cleanup function
    return () => {
      // On cleanup, reset the ref so this effect can run again if needed
      // But don't cancel the promise - we want it to complete
      initializationInitiatedRef.current = false;
    };
  }, [user, sessionId]); // Include sessionId to re-run if it becomes null

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          background: "linear-gradient(135deg, #6b7fd7 0%, #7c5aa3 40%, #5a9bc8 100%)",
          position: "relative",
          "&::before": {
            content: '""',
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.15)",
            zIndex: 0,
            pointerEvents: "none",
          },
        }}
      >
        <Box sx={{ position: "relative", zIndex: 1 }}>
          <Loader size={60} />
          <Typography
            sx={{
              color: "#FFFFFF",
              fontWeight: 600,
              fontSize: "1.125rem",
              mt: 2,
              textShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
            }}
          >
            Loading...
          </Typography>
        </Box>
      </Box>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <BrowserRouter>
      <Box
        sx={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #6b7fd7 0%, #7c5aa3 40%, #5a9bc8 100%)",
          position: "relative",
          "&::before": {
            content: '""',
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.15)",
            zIndex: 0,
            pointerEvents: "none",
          },
        }}
      >
        <AppBar
          position="static"
          elevation={0}
          sx={{
            background: "rgba(255, 255, 255, 0.1)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.2)",
            position: "relative",
            zIndex: 1,
          }}
        >
          <Toolbar>
            <Typography
              variant="h6"
              component="div"
              sx={{
                flexGrow: 1,
                fontWeight: 700,
                background: "linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              DocBot
            </Typography>
            <Button
              color="inherit"
              onClick={handleLogout}
              startIcon={<LogoutIcon />}
              sx={{
                color: "white",
                textTransform: "none",
                fontWeight: 500,
                "&:hover": {
                  backgroundColor: "rgba(255, 255, 255, 0.2)",
                },
              }}
            >
              Logout
            </Button>
          </Toolbar>
        </AppBar>
        <Box sx={{ flex: 1, overflow: "hidden", position: "relative", zIndex: 1 }}>
          <Routes>
            <Route
              path="/"
              element={
                sessionId ? (
                  <Navigate to="/ingest" replace />
                ) : (
                  <Container sx={{ py: 4, textAlign: "center", position: "relative", zIndex: 1 }}>
                    <Loader size={60} />
                    <Typography
                      sx={{
                        mt: 3,
                        color: "#FFFFFF",
                        fontWeight: 600,
                        fontSize: "1.125rem",
                        textShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
                      }}
                    >
                      Initializing session...
                    </Typography>
                  </Container>
                )
              }
            />
            <Route
              path="/ingest"
              element={
                sessionId ? (
                  <Ingest sessionId={sessionId} />
                ) : (
                  <Container sx={{ py: 4, textAlign: "center", position: "relative", zIndex: 1 }}>
                    <Loader size={60} />
                    <Typography
                      sx={{
                        mt: 3,
                        color: "#FFFFFF",
                        fontWeight: 600,
                        fontSize: "1.125rem",
                        textShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
                      }}
                    >
                      Initializing session...
                    </Typography>
                  </Container>
                )
              }
            />
            <Route
              path="/chat"
              element={
                sessionId ? (
                  <Chat sessionId={sessionId} />
                ) : (
                  <Navigate to="/ingest" replace />
                )
              }
            />
          </Routes>
        </Box>
      </Box>
    </BrowserRouter>
  );
}

export default App;
