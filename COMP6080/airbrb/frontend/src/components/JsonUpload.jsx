import { Box, Button, Typography } from '@mui/material';

function JsonUpload({ onUpload, onError, error }) {
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (ev) => {
      try {
        const text = ev.target.result;
        const data = JSON.parse(text);
        onUpload && onUpload(data);
      } catch (err) {
        console.error('Invalid JSON file:', err);
        onError && onError('Invalid JSON file.');
      }
    };

    reader.readAsText(file);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button component="label" variant="outlined" size="small">
                    Upload .json file
          <input
            type="file"
            hidden
            accept="application/json"
            onChange={handleFileChange}
            data-testid="json-input"
          />
        </Button>
        <Button
          variant="outlined"
          size="small"
          component="a"
          href="/2.6.json"
          download="2.6.json"
        >
                    Download example .json
        </Button>
      </Box>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mt: 1 }}
      >
                Upload a JSON file to fill this form.
      </Typography>

      {error && (
        <Typography
          variant="body2"
          color="error"
          sx={{ mt: 1 }}
        >
          {error}
        </Typography>
      )}
    </Box>
  );
}

export default JsonUpload;
