import { useEffect, useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import axios from 'axios';

import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import NavBar from './pages/NavBar.jsx';
import Homes from './pages/Homes.jsx';
import MyListings from './pages/MyListings.jsx';
import EditListing from './pages/EditListing.jsx';
import CreateListing from './pages/CreateListing.jsx';
import ViewListing from './pages/ViewListing.jsx';
import ManageBooking from './pages/ManageBooking.jsx';

function App() {

  const navigate = useNavigate();

  const [token, setToken] = useState('CHECKING');
  const [email, setEmail] = useState(null);
  const [listingOwnerMap, setListingOwnerMap] = useState({});

  useEffect(() => {
    const lsToken = localStorage.getItem('token');
    const lsEmail = localStorage.getItem('email');
    setToken(lsToken);
    setEmail(lsEmail);

    const loadOwners = async () => {
      const res = await fetch("http://localhost:5005/listings");
      const data = await res.json();

      const map = {};
      data.listings.forEach((l) => {
        map[l.id] = l.owner;
      });

      setListingOwnerMap(map);
    };
    loadOwners();
  }, []);

  const logout = async () => {
    await axios.post('http://localhost:5005/user/auth/logout', {}, {
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    });
    localStorage.removeItem('token');
    localStorage.removeItem('email');
    setToken(null);
    setEmail(null);
    navigate('/');
  }

  if (token === 'CHECKING') {
    return null;
  }

  return (
    <div>
      <nav>
        <NavBar token={token} logout={logout} currentUserEmail={email} listingOwnerMap={listingOwnerMap}/>
      </nav>

      <Routes>
        <>
          <Route path="/" element={<Homes />} />
          <Route path='/login' element={<Login setToken={setToken} setEmail={setEmail} />}></Route>
          <Route path='/register' element={<Register setToken={setToken} setEmail={setEmail} />}></Route>
          <Route path='/homes' element={<Homes />}></Route>
          <Route path='/my-listings' element={<MyListings />}></Route>
          <Route path="/listings/:id/edit" element={<EditListing />} />
          <Route path="/listings/create" element={<CreateListing />} />
          <Route path="/listings/:id" element={<ViewListing />} />
          <Route path="/listings/:id/manage" element={<ManageBooking />} />
        </>
      </Routes>
    </div>
  )
}

export default App
