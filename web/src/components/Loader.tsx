import { Box } from "@mui/material";

interface LoaderProps {
  size?: number;
  message?: string;
}

export default function Loader({ size = 40, message }: LoaderProps) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
      }}
    >
      <Box
        sx={{
          width: size,
          height: size,
          position: "relative",
          "&::before": {
            content: '""',
            position: "absolute",
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            border: `3px solid rgba(255, 255, 255, 0.2)`,
          },
          "&::after": {
            content: '""',
            position: "absolute",
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            border: `3px solid transparent`,
            borderTopColor: "#ffffff",
            borderRightColor: "#ffffff",
            animation: "spin 1s linear infinite",
          },
          "@keyframes spin": {
            "0%": {
              transform: "rotate(0deg)",
            },
            "100%": {
              transform: "rotate(360deg)",
            },
          },
        }}
      >
        {/* Pulsing inner dot */}
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: size * 0.3,
            height: size * 0.3,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #ffffff 0%, rgba(255, 255, 255, 0.8) 100%)",
            transform: "translate(-50%, -50%)",
            animation: "pulse 1.5s ease-in-out infinite",
            "@keyframes pulse": {
              "0%, 100%": {
                opacity: 1,
                transform: "translate(-50%, -50%) scale(1)",
              },
              "50%": {
                opacity: 0.6,
                transform: "translate(-50%, -50%) scale(1.2)",
              },
            },
          }}
        />
      </Box>
      {message && (
        <Box
          sx={{
            display: "flex",
            gap: 0.5,
            alignItems: "center",
          }}
        >
          <Box
            component="span"
            sx={{
              animation: "dots 1.4s ease-in-out infinite",
              "@keyframes dots": {
                "0%, 20%": {
                  opacity: 0,
                },
                "50%": {
                  opacity: 1,
                },
                "100%": {
                  opacity: 0,
                },
              },
            }}
          >
            ●
          </Box>
          <Box
            component="span"
            sx={{
              animation: "dots 1.4s ease-in-out 0.2s infinite",
            }}
          >
            ●
          </Box>
          <Box
            component="span"
            sx={{
              animation: "dots 1.4s ease-in-out 0.4s infinite",
            }}
          >
            ●
          </Box>
        </Box>
      )}
    </Box>
  );
}

