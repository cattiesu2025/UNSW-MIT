import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Alert from '@mui/material/Alert';
import axios from 'axios';

function Login(props) {

  const navigate = useNavigate();

  const [open, setOpen] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleClose = () => {
    setOpen(false);
    navigate('/');
  };

  const submit = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email and password');
      return;
    }

    const bodyObj = { email, password };
    try {
      const response = await axios.post('http://localhost:5005/user/auth/login', bodyObj);
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('email', email);
      props.setToken(response.data.token);
      props.setEmail(email);
      setOpen(false);
      navigate('/');
    } catch (error) {
      if (error.response?.data?.error) {
        setErrorMsg(error.response.data.error);
      } else {
        setErrorMsg('An unexpected error occurred');
      }
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <DialogTitle>Login</DialogTitle>
        <DialogContent dividers>
          <TextField
            id="login-email"
            label="Email"
            fullWidth
            variant="outlined"
            margin="normal"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-cy="login-email"
          />
          <TextField
            id="login-password"
            label="Password"
            fullWidth
            type="password"
            variant="outlined"
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            data-cy="login-password"
          />
          {errorMsg && <Alert severity="error" sx={{ mt: 2 }}>{errorMsg}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button type="submit" variant="contained" onClick={submit} data-cy="login-submit">Login</Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

export default Login
