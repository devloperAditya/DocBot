import { useState } from "react";
import {
  Box,
  Container,
  Typography,
  Button,
  Alert,
  alpha,
} from "@mui/material";
import Loader from "../components/Loader";
import {
  Google as GoogleIcon,
  AutoStories as BookIcon,
  SmartToy as BotIcon,
  Stars as StarsIcon,
} from "@mui/icons-material";
import { signInWithGoogle } from "../firebase";

interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      // Auth state change will be handled by App.tsx's onAuthStateChanged listener
      // Session initialization will happen automatically via useEffect when user state updates
      // No need to manually call onLogin - the App component's auth listener will handle it
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in");
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // Subtle static gradient background
        background: "linear-gradient(135deg, #6b7fd7 0%, #7c5aa3 40%, #5a9bc8 100%)",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.15)",
          zIndex: 0,
        },
      }}
    >
      {/* Subtle decorative elements */}
      <Box
        sx={{
          position: "absolute",
          top: "10%",
          left: "10%",
          opacity: 0.1,
          zIndex: 0,
        }}
      >
        <BookIcon sx={{ fontSize: 80, color: "white" }} />
      </Box>
      <Box
        sx={{
          position: "absolute",
          top: "20%",
          right: "15%",
          opacity: 0.08,
          zIndex: 0,
        }}
      >
        <StarsIcon sx={{ fontSize: 60, color: "white" }} />
      </Box>
      <Box
        sx={{
          position: "absolute",
          bottom: "15%",
          left: "20%",
          opacity: 0.1,
          zIndex: 0,
        }}
      >
        <BotIcon sx={{ fontSize: 70, color: "white" }} />
      </Box>

      <Container maxWidth="sm" sx={{ position: "relative", zIndex: 1 }}>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            py: 4,
          }}
        >
          {/* Glassmorphism card */}
          <Box
            sx={{
              width: "100%",
              maxWidth: 450,
              background: alpha("#ffffff", 0.15),
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              borderRadius: 4,
              border: "1px solid rgba(255, 255, 255, 0.2)",
              boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.37)",
              p: 5,
              textAlign: "center",
              position: "relative",
              overflow: "hidden",
              "&::before": {
                content: '""',
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "3px",
                background: "linear-gradient(90deg, #667eea, #764ba2, #5a9bc8)",
              },
            }}
          >
            {/* Logo/Icon */}
            <Box
              sx={{
                mb: 3,
                animation: "scaleIn 0.5s ease-out",
                "@keyframes scaleIn": {
                  "0%": {
                    transform: "scale(0)",
                    opacity: 0,
                  },
                  "100%": {
                    transform: "scale(1)",
                    opacity: 1,
                  },
                },
              }}
            >
              <Box
                sx={{
                  display: "inline-flex",
                  p: 2,
                  borderRadius: "50%",
                  background: "rgba(255, 255, 255, 0.2)",
                  backdropFilter: "blur(10px)",
                  mb: 2,
                }}
              >
                <BotIcon sx={{ fontSize: 48, color: "white" }} />
              </Box>
            </Box>

            <Typography
              variant="h3"
              component="h1"
              gutterBottom
              sx={{
                fontWeight: 700,
                mb: 1,
                background: "linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                fontSize: { xs: "2rem", sm: "2.5rem" },
                animation: "fadeInUp 0.6s ease-out 0.2s both",
                "@keyframes fadeInUp": {
                  "0%": {
                    opacity: 0,
                    transform: "translateY(20px)",
                  },
                  "100%": {
                    opacity: 1,
                    transform: "translateY(0)",
                  },
                },
              }}
            >
              DocBot
            </Typography>

            <Typography
              variant="body1"
              sx={{
                mb: 4,
                color: "#FFFFFF",
                fontSize: "1.1rem",
                fontWeight: 400,
                textShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
                animation: "fadeInUp 0.6s ease-out 0.4s both",
              }}
            >
              Transform your documents into intelligent conversations
            </Typography>

            {error && (
              <Alert
                severity="error"
                sx={{
                  mb: 3,
                  background: "rgba(211, 47, 47, 0.25)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(211, 47, 47, 0.5)",
                  color: "#FFFFFF",
                  fontWeight: 500,
                  fontSize: "0.9375rem",
                  textShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
                  animation: "fadeInUp 0.6s ease-out 0.6s both",
                }}
              >
                {error}
              </Alert>
            )}

            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={handleSignIn}
              disabled={loading}
              startIcon={loading ? null : <GoogleIcon />}
              sx={{
                py: 1.8,
                fontSize: "1.1rem",
                textTransform: "none",
                fontWeight: 600,
                borderRadius: 2,
                background: loading
                  ? "rgba(255, 255, 255, 0.3)"
                  : "linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%)",
                color: loading ? "#FFFFFF" : "#1a1a1a",
                boxShadow: loading
                  ? "0 2px 8px 0 rgba(0, 0, 0, 0.1)"
                  : "0 4px 15px 0 rgba(0, 0, 0, 0.2)",
                transition: "all 0.3s ease",
                position: "relative",
                "&:hover": {
                  background: loading
                    ? "rgba(255, 255, 255, 0.3)"
                    : "linear-gradient(135deg, #f5f5f5 0%, #ffffff 100%)",
                  boxShadow: loading
                    ? "0 2px 8px 0 rgba(0, 0, 0, 0.1)"
                    : "0 6px 20px 0 rgba(0, 0, 0, 0.3)",
                  transform: loading ? "none" : "translateY(-2px)",
                },
                "&:active": {
                  transform: "translateY(0px)",
                },
                "&.Mui-disabled": {
                  background: "rgba(255, 255, 255, 0.3)",
                  color: "#FFFFFF",
                },
                animation: "fadeInUp 0.6s ease-out 0.8s both",
              }}
            >
              {loading ? (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Loader size={20} />
                  <span>Signing in...</span>
                </Box>
              ) : (
                "Continue with Google"
              )}
            </Button>

            <Typography
              variant="caption"
              sx={{
                mt: 3,
                color: "#FFFFFF",
                display: "block",
                fontSize: "0.875rem",
                fontWeight: 500,
                textShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
                animation: "fadeInUp 0.6s ease-out 1s both",
              }}
            >
              Secure • Fast • Intelligent
            </Typography>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

