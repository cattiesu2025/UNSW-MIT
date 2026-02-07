import { useState, useEffect, useRef } from 'react';
import {AppBar, Toolbar, Button, Typography, Box, IconButton, Badge, Menu, MenuItem, ListItemText, Divider} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { Link, useNavigate } from 'react-router-dom';

function NavBar({ token, logout, currentUserEmail, listingOwnerMap }) {
  const navigate = useNavigate();

  const [anchorEl, setAnchorEl] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const menuOpen = Boolean(anchorEl);

  const prevBookingsRef = useRef({}); 

  const handleOpenMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };
  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = (notif) => {
    // 1) read
    setNotifications((prev) => {
      const updated = prev.map((n) =>
        n.id === notif.id ? { ...n, read: true } : n
      );
      const nextUnread = updated.filter((n) => !n.read).length;
      setUnreadCount(nextUnread);
      return updated;
    });
  
    // 2) guest: bookingId -> localStorage
    if (notif.type === 'guest' && notif.bookingId && currentUserEmail) {
      const key = `seenGuestBookings:${currentUserEmail}`;
      let ids = [];
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          ids = JSON.parse(saved);
        } catch {
          ids = [];
        }
      }
      if (!ids.includes(notif.bookingId)) {
        ids.push(notif.bookingId);
        localStorage.setItem(key, JSON.stringify(ids));
        navigate(`/listings/${notif.listingId}`);
      }
    }

    if (notif.type === 'host' && notif.bookingId && currentUserEmail) {
      navigate(`/listings/${notif.listingId}/manage`);
    }
  
    handleCloseMenu();
  };
   
  // polling /bookings
  useEffect(() => {
    if (!token) {
      prevBookingsRef.current = {};
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    if (
      !currentUserEmail ||
      !listingOwnerMap ||
      Object.keys(listingOwnerMap).length === 0
    ) {
      return;
    }

    const pollBookings = async () => {
      try {
        const res = await fetch('http://localhost:5005/bookings', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) return;

        const data = await res.json();
        const bookings = data.bookings || [];

        const prevMap = prevBookingsRef.current;
        const newMap = {};
        const newNotifs = [];

        let seenIds = [];
        if (currentUserEmail) {
          const key = `seenGuestBookings:${currentUserEmail}`;
          const saved = localStorage.getItem(key);
          if (saved) {
            try {
              seenIds = JSON.parse(saved);
            } catch {
              seenIds = [];
            }
          }
        }

        bookings.forEach((b) => {
          const prev = prevMap[b.id];
          newMap[b.id] = b;

          const listingOwner = listingOwnerMap[b.listingId];
          const isHost = listingOwner === currentUserEmail;

          // ===== 1) new pending booking: Host notif =====
          if (!prev && b.status === 'pending' && isHost) {
            newNotifs.push({
              id: `host-${b.id}-${Date.now()}`,
              bookingId: b.id,
              listingId: b.listingId,
              type: 'host',
              message: `New booking request for your listing ${b.listingId}`,
              read: false,
              createdAt: new Date().toISOString(),
            });
          }

          // ===== 2) status: pending -> accepted/declined: Guest notif =====
          const prevStatus = prev ? prev.status : null;
          const isGuest = b.owner === currentUserEmail;
          const alreadySeen = seenIds.includes(b.id);
          if (
            isGuest &&
            prevStatus !== b.status &&
            (b.status === 'accepted' || b.status === 'declined')
          ) {
            if (!alreadySeen) {
              newNotifs.push({
                id: `guest-${b.id}-${b.status}-${Date.now()}`,
                bookingId: b.id,
                listingId: b.listingId,
                type: 'guest', 
                message: `Your booking for listing ${b.listingId} was ${b.status}.`,
                read: false,
                createdAt: new Date().toISOString(),
              });
            }
          }
        });

        prevBookingsRef.current = newMap;

        if (newNotifs.length > 0) {
          setNotifications((prev) => [...newNotifs, ...prev]);
          setUnreadCount((prev) => prev + newNotifs.length);
        }

      } catch (err) {
        console.error('pollBookings error', err);
      }
    };

    pollBookings();
    const id = setInterval(pollBookings, 5000);

    return () => clearInterval(id);
  }, [token, currentUserEmail, listingOwnerMap]);

  return (
    <AppBar position="static" color="transparent" elevation={0}>
      <Toolbar>
        <Typography
          variant="h6"
          noWrap
          component="a"
          href="/"
          sx={{
            mr: 2,
            display: { xs: 'none', md: 'flex' },
            fontWeight: 700,
            letterSpacing: '.3rem',
            color: 'darkred',
            textDecoration: 'none',
          }}
        >
          Airbrb
        </Typography>

        <Button color="inherit" component={Link} to="/homes">
          Homes
        </Button>

        {token && (
          <Button color="inherit" component={Link} to="/my-listings">
            My Listings
          </Button>
        )}

        <Box sx={{ flexGrow: 1 }} />

        {token && (
          <>
            <IconButton
              color="inherit"
              onClick={handleOpenMenu}
              aria-controls={menuOpen ? 'notifications-menu' : undefined}
              aria-haspopup="true"
              aria-expanded={menuOpen ? 'true' : undefined}
            >
              <Badge badgeContent={unreadCount} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>

            <Menu
              id="notifications-menu"
              anchorEl={anchorEl}
              open={menuOpen}
              onClose={handleCloseMenu}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <MenuItem disabled>
                <ListItemText
                  primary="Notifications"
                  secondary={
                    unreadCount > 0
                      ? `${unreadCount} unread`
                      : 'All caught up'
                  }
                />
              </MenuItem>
              <Divider />

              {notifications.length === 0 && (
                <MenuItem disabled>
                  <ListItemText primary="No notifications yet" />
                </MenuItem>
              )}

              {notifications.map((n) => (
                <MenuItem
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  sx={{
                    fontWeight: n.read ? 'normal' : 'bold',
                    color: n.read ? 'text.secondary' : 'text.primary',
                    bgcolor: n.read ? 'inherit' : 'rgba(25, 118, 210, 0.08)',
                    whiteSpace: 'normal',
                  }}
                >
                  <ListItemText
                    primary={n.message}
                    secondary={
                      n.createdAt
                        ? new Date(n.createdAt).toLocaleString()
                        : null
                    }
                  />
                </MenuItem>
              ))}
            </Menu>
          </>
        )}

        {token ? (
          <Button color="inherit" onClick={logout} data-cy="nav-logout">
            Logout
          </Button>
        ) : (
          <>
            <Button color="inherit" component={Link} to="/login" data-cy="nav-login">
              Login
            </Button>
            <Button color="inherit" component={Link} to="/register" data-cy="nav-register">
              Register
            </Button>
          </>
        )}
      </Toolbar>
    </AppBar>
  );
}

export default NavBar;
