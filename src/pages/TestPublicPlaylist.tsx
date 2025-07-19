const TestPublicPlaylist = () => {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>Test Public Playlist Page</h1>
      <p>If you can see this without being redirected, the routing works!</p>
      <p>Current URL: {window.location.href}</p>
      <p>Time: {new Date().toISOString()}</p>
    </div>
  );
};

export default TestPublicPlaylist;