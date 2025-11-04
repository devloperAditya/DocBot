import { Box, Chip } from "@mui/material";
import { Description as DescriptionIcon } from "@mui/icons-material";

interface Source {
  chunk_idx: number;
  score: number;
  source: string;
}

interface SourceChipsProps {
  sources: Source[];
}

export default function SourceChips({ sources }: SourceChipsProps) {
  if (sources.length === 0) return null;

  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        gap: 1,
        mt: 1,
      }}
    >
      {sources.map((source, idx) => (
        <Chip
          key={idx}
          icon={<DescriptionIcon />}
          label={`Chunk ${source.chunk_idx} (${source.source}) - ${Math.round(source.score * 100)}%`}
          size="small"
          variant="outlined"
          color="primary"
          title={`Similarity Score: ${source.score.toFixed(2)}`}
          sx={{
            fontSize: "0.75rem",
            height: "auto",
            "& .MuiChip-label": {
              py: 0.5,
            },
          }}
        />
      ))}
    </Box>
  );
}

