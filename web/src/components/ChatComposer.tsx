import { useState, FormEvent } from "react";
import { Box, TextField, IconButton, Paper, alpha } from "@mui/material";
import { Send as SendIcon } from "@mui/icons-material";

interface ChatComposerProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function ChatComposer({ onSend, disabled }: ChatComposerProps) {
  const [message, setMessage] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage("");
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 0,
        background: "rgba(255, 255, 255, 0.1)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255, 255, 255, 0.2)",
      }}
    >
      <form onSubmit={handleSubmit}>
        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end" }}>
          <TextField
            fullWidth
            multiline
            maxRows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask a question about your document..."
            disabled={disabled}
            variant="outlined"
            sx={{
              "& .MuiOutlinedInput-root": {
                backgroundColor: alpha("#ffffff", 0.9),
                color: "#333",
                "&:hover": {
                  backgroundColor: alpha("#ffffff", 0.95),
                },
                "& fieldset": {
                  borderColor: "rgba(255, 255, 255, 0.3)",
                },
                "&:hover fieldset": {
                  borderColor: "rgba(255, 255, 255, 0.5)",
                },
                "&.Mui-focused fieldset": {
                  borderColor: "rgba(255, 255, 255, 0.7)",
                },
              },
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <IconButton
            type="submit"
            disabled={disabled || !message.trim()}
            sx={{
              mb: 0.5,
              background: "linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%)",
              color: "#333",
              boxShadow: "0 4px 15px 0 rgba(0, 0, 0, 0.2)",
              transition: "all 0.3s ease",
              "&:hover": {
                background: "linear-gradient(135deg, #f5f5f5 0%, #ffffff 100%)",
                boxShadow: "0 6px 20px 0 rgba(0, 0, 0, 0.3)",
                transform: "translateY(-2px)",
              },
              "&:active": {
                transform: "translateY(0px)",
              },
              "&.Mui-disabled": {
                background: "rgba(255, 255, 255, 0.3)",
                color: "rgba(255, 255, 255, 0.6)",
              },
            }}
          >
            <SendIcon />
          </IconButton>
        </Box>
      </form>
    </Paper>
  );
}

