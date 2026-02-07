import { useState, useEffect } from 'react';
import { Box, Button, Popover, Slider, Typography } from '@mui/material';

function BedroomRangeDropdown({ value = [0, 10], onChange }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSliderChange = (event, newValue) => {
    setLocalValue(newValue);
  };

  const handleApply = () => {
    if (onChange) {
      onChange(localValue[0], localValue[1]);
    }
    handleClose();
  };

  const open = Boolean(anchorEl);
  const display = `${localValue[0]} - ${localValue[1]}`;

  return (
    <Box>
      <Button
        onClick={handleClick}
        sx={{
          textTransform: 'none',
          color: 'black',
          backgroundColor: 'white',
          px: 1.5,
          py: 0.5,
          fontSize: 14,
          width: '100%',
          justifyContent: 'flex-start',
        }}
      >
        {display}
      </Button>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        <Box sx={{ p: 2, width: 260 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Select bedrooms range
          </Typography>
          <Slider
            value={localValue}
            onChange={handleSliderChange}
            valueLabelDisplay="auto"
            min={0}
            max={10}
            step={1}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2">{localValue[0]}</Typography>
            <Typography variant="body2">{localValue[1]}</Typography>
          </Box>
          <Button
            fullWidth
            variant="contained"
            sx={{ backgroundColor: '#ff385c', '&:hover': { backgroundColor: '#e31c5f' } }}
            onClick={handleApply}
          >
            Apply
          </Button>
        </Box>
      </Popover>
    </Box>
  );
}

export default BedroomRangeDropdown;
