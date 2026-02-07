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

function Register(props) {

  const navigate = useNavigate();

  const [open, setOpen] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleClose = () => {
    setOpen(false);
    navigate('/');
  };

  const submit = async () => {
    if (confirmPassword != password) {
      setErrorMsg('Passwords do not match');
      return;
    } else {
      setErrorMsg('');
    }

    const bodyObj = { email, password, name };
    try {
      const response = await axios.post('http://localhost:5005/user/auth/register', bodyObj);
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
        <DialogTitle>Register</DialogTitle>
        <DialogContent dividers>
          <TextField
            id='register-email'
            label='Email'
            fullWidth
            variant='outlined'
            margin="normal"
            value={email}
            onChange={(event) => { setEmail(event.target.value); }}
            data-cy="register-email"
          />
          <br />
          <TextField
            id='register-password'
            label='Password'
            fullWidth
            type='password'
            variant='outlined'
            margin="normal"
            value={password}
            onChange={(event) => { setPassword(event.target.value); }}
            data-cy="register-password"
          />
          <br />
          <TextField
            id='register-confirm-password'
            label='Confirm Password'
            fullWidth
            type='password'
            variant='outlined'
            margin="normal"
            value={confirmPassword}
            onChange={(event) => { setConfirmPassword(event.target.value); }}
            data-cy="register-confirm-password"
          />
          <br />
          <TextField
            id='register-name'
            label='Name'
            fullWidth
            variant='outlined'
            margin="normal"
            value={name}
            onChange={(event) => { setName(event.target.value); }}
            data-cy="register-name"
          />
          <br />
          {errorMsg && <Alert severity="error" sx={{ mt: 2 }}>{errorMsg}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button type="submit" variant="contained" onClick={submit} data-cy="register-submit">Sign Up</Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

export default Register
