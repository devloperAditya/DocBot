import { Box, Typography, Paper, Avatar } from "@mui/material";
import { Person as PersonIcon, SmartToy as BotIcon } from "@mui/icons-material";
import SourceChips from "./SourceChips";

export interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ chunk_idx: number; score: number; source: string }>;
}

interface MessageListProps {
  messages: Message[];
}

export default function MessageList({ messages }: MessageListProps) {
  return (
    <Box
      sx={{
        flex: 1,
        overflowY: "auto",
        p: 2,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      {messages.length === 0 ? (
        <Box
          sx={{
            textAlign: "center",
            mt: 8,
          }}
        >
          <BotIcon sx={{ fontSize: 64, mb: 2, opacity: 0.8, color: "#FFFFFF" }} />
          <Typography
            variant="h6"
            sx={{
              color: "#FFFFFF",
              fontWeight: 600,
              fontSize: "1.125rem",
              textShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
            }}
          >
            Start chatting with your document...
          </Typography>
          <Typography
            variant="body2"
            sx={{
              mt: 1,
              color: "#FFFFFF",
              fontWeight: 400,
              fontSize: "0.9375rem",
              textShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
            }}
          >
            Ask questions and get answers based on your uploaded content
          </Typography>
        </Box>
      ) : (
        messages.map((message, idx) => (
          <Box
            key={idx}
            sx={{
              display: "flex",
              justifyContent: message.role === "user" ? "flex-end" : "flex-start",
              gap: 1,
            }}
          >
            {message.role === "assistant" && (
              <Avatar
                sx={{
                  bgcolor: "primary.main",
                  width: 32,
                  height: 32,
                }}
              >
                <BotIcon fontSize="small" />
              </Avatar>
            )}
            <Paper
              elevation={0}
              sx={{
                maxWidth: "70%",
                p: 2,
                ...(message.role === "user"
                  ? {
                      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      color: "#FFFFFF",
                      boxShadow: "0 4px 15px 0 rgba(0, 0, 0, 0.2)",
                    }
                  : {
                      bgcolor: "rgba(255, 255, 255, 0.95)",
                      backdropFilter: "blur(20px)",
                      WebkitBackdropFilter: "blur(20px)",
                      border: "1px solid rgba(255, 255, 255, 0.5)",
                      color: "#1a1a1a",
                      boxShadow: "0 4px 20px 0 rgba(0, 0, 0, 0.15)",
                    }),
                borderRadius: 2,
                borderTopLeftRadius: message.role === "assistant" ? 0 : 2,
                borderTopRightRadius: message.role === "user" ? 0 : 2,
              }}
            >
              <Typography
                variant="body1"
                sx={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  color: message.role === "user" ? "#FFFFFF" : "#1a1a1a",
                  fontWeight: 400,
                  fontSize: "0.9375rem",
                  lineHeight: 1.6,
                  textShadow: message.role === "user" ? "0 1px 2px rgba(0, 0, 0, 0.2)" : "none",
                }}
              >
                {message.content}
              </Typography>
              {message.role === "assistant" && message.sources && (
                <Box sx={{ mt: 2 }}>
                  <SourceChips sources={message.sources} />
                </Box>
              )}
            </Paper>
            {message.role === "user" && (
              <Avatar
                sx={{
                  bgcolor: "secondary.main",
                  width: 32,
                  height: 32,
                }}
              >
                <PersonIcon fontSize="small" />
              </Avatar>
            )}
          </Box>
        ))
      )}
    </Box>
  );
}

