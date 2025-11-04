import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Button,
  Paper,
  alpha,
} from "@mui/material";
import Loader from "../components/Loader";
import { ExitToApp as ExitToAppIcon, Refresh as RefreshIcon } from "@mui/icons-material";
import { chat as sendChatMessage, endSession, startSession } from "../lib/api";
import MessageList, { Message } from "../components/MessageList";
import ChatComposer from "../components/ChatComposer";

interface ChatProps {
  sessionId: string;
}

export default function Chat({ sessionId }: ChatProps) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [endingSession, setEndingSession] = useState(false);

  const handleSend = async (userMessage: string) => {
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const response = await sendChatMessage({
        sessionId,
        userMessage,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.answer,
          sources: response.sources,
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${error instanceof Error ? error.message : "Failed to get response"}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleEndSession = async () => {
    setEndingSession(true);
    try {
      // End the current session
      await endSession(sessionId);
      
      // Clear the current session from storage
      sessionStorage.removeItem("sessionId");
      
      // Create a new session automatically
      const newSession = await startSession();
      sessionStorage.setItem("sessionId", newSession.sessionId);
      
      // Dispatch custom event to notify App.tsx of the new session
      window.dispatchEvent(new Event("sessionStorage"));
      
      // Small delay to ensure state updates propagate
      setTimeout(() => {
        // Navigate to ingest page so user can upload a new document
        navigate("/ingest");
      }, 100);
    } catch (error) {
      console.error("Error ending session or creating new session:", error);
      // Even if there's an error, navigate to ingest - App.tsx will handle session creation
      sessionStorage.removeItem("sessionId");
      navigate("/ingest");
    } finally {
      setEndingSession(false);
    }
  };

  // Handle beforeunload only - don't end session on component unmount
  // (component unmount happens on navigation, which is normal and shouldn't end the session)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (sessionId) {
        // Only end session when the user is actually leaving the page/tab
        // Using sendBeacon for best-effort cleanup on page close to avoid race conditions
        navigator.sendBeacon(
          `${import.meta.env.VITE_API_BASE_URL}/endSession`,
          JSON.stringify({ sessionId })
        );
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [sessionId]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        maxWidth: "1200px",
        margin: "0 auto",
        width: "100%",
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderRadius: 0,
          background: "rgba(255, 255, 255, 0.1)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.2)",
        }}
      >
        <Typography
          variant="h5"
          component="h1"
          sx={{
            fontWeight: 700,
            background: "linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Chat with Document
        </Typography>
        <Button
          variant="outlined"
          onClick={handleEndSession}
          disabled={endingSession}
          startIcon={endingSession ? <RefreshIcon /> : <ExitToAppIcon />}
          sx={{
            textTransform: "none",
            color: "white",
            borderColor: "rgba(255, 255, 255, 0.5)",
            fontWeight: 500,
            "&:hover": {
              borderColor: "rgba(255, 255, 255, 0.8)",
              backgroundColor: "rgba(255, 255, 255, 0.1)",
            },
            "&:disabled": {
              borderColor: "rgba(255, 255, 255, 0.3)",
              color: "rgba(255, 255, 255, 0.7)",
            },
          }}
        >
          {endingSession ? "Starting New Session..." : "New Document"}
        </Button>
      </Paper>
      <Box sx={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <MessageList messages={messages} />
        {loading && (
          <Box
            sx={{
              p: 3,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
            }}
          >
            <Loader size={32} />
            <Typography
              variant="body1"
              sx={{
                color: "#FFFFFF",
                fontWeight: 500,
                fontSize: "0.9375rem",
                textShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
              }}
            >
              Thinking...
            </Typography>
          </Box>
        )}
      </Box>
      <ChatComposer onSend={handleSend} disabled={loading} />
    </Box>
  );
}

