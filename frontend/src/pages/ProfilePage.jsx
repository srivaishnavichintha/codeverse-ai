import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchFullProfile } from '../services/profileService';

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (user?.username) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      const res = await fetchFullProfile(user.username);

      console.log(res);

      setProfile(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  if (!profile) {
    return <h1>Loading...</h1>;
  }

  return (
    <div style={{ padding: '40px', color: 'white' }}>
      <h1>{profile.displayName}</h1>

      <p>Username: {profile.username}</p>

      <p>Email: {profile.email}</p>

      <p>Country: {profile.country || 'Not Added'}</p>

      <p>Bio: {profile.bio || 'No bio yet'}</p>

      <p>Credits: {profile.credits}</p>

      <p>Rating: {profile.rating}</p>

      <p>Total Solved: {profile.stats?.totalSolved}</p>

      <p>Total Submissions: {profile.stats?.totalSubmissions}</p>

      <p>Role: {profile.role}</p>
    </div>
  );
}