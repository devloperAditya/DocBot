import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Card,
  CardContent,
  Typography,
  Box,
  Alert,
  alpha,
} from "@mui/material";
import { CloudUpload as CloudUploadIcon } from "@mui/icons-material";
import Loader from "../components/Loader";
import { ingest as ingestDocument } from "../lib/api";

interface IngestProps {
  sessionId: string;
}

export default function Ingest({ sessionId }: IngestProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      await ingestDocument({
        sessionId,
        file: file,
      });
      navigate("/chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to ingest file");
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4, position: "relative", zIndex: 1 }}>
      <Box sx={{ mb: 4, textAlign: "center" }}>
        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          sx={{
            fontWeight: 700,
            mb: 1,
            background: "linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Upload Document
        </Typography>
        <Typography
          variant="body1"
          sx={{
            color: "#FFFFFF",
            fontSize: "1.125rem",
            fontWeight: 400,
            textShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
          }}
        >
          Upload a document file to start chatting with it
        </Typography>
      </Box>

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
          }}
        >
          {error}
        </Alert>
      )}

      <Card
        elevation={0}
        sx={{
          background: alpha("#ffffff", 0.15),
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderRadius: 4,
          border: "1px solid rgba(255, 255, 255, 0.2)",
          boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.37)",
        }}
      >
        <CardContent>
          <Typography
            variant="h6"
            gutterBottom
            sx={{
              mb: 2,
              fontWeight: 600,
              color: "#FFFFFF",
              textShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
            }}
          >
            Upload File
          </Typography>
          <Box
            component="label"
            htmlFor="fileUpload"
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              p: 4,
              border: "2px dashed",
              borderColor: "rgba(255, 255, 255, 0.5)",
              borderRadius: 2,
              cursor: loading ? "not-allowed" : "pointer",
              backgroundColor: alpha("#ffffff", 0.1),
              transition: "all 0.3s ease",
              "&:hover": {
                backgroundColor: alpha("#ffffff", 0.2),
                borderColor: "rgba(255, 255, 255, 0.7)",
                transform: "scale(1.02)",
              },
            }}
          >
            <input
              id="fileUpload"
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleFileUpload}
              disabled={loading}
              style={{ display: "none" }}
            />
            {loading ? (
              <Loader size={48} />
            ) : (
              <CloudUploadIcon sx={{ fontSize: 48, color: "#FFFFFF", mb: 2 }} />
            )}
            <Typography
              variant="body1"
              sx={{
                mb: 1,
                fontWeight: 600,
                color: "#FFFFFF",
                fontSize: "1rem",
                textShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
              }}
            >
              {loading ? "Processing file..." : "Click to upload or drag and drop"}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: "#FFFFFF",
                fontWeight: 400,
                fontSize: "0.875rem",
                textShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
              }}
            >
              PDF, DOCX, DOC, or TXT (Max file size: 10MB)
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}

