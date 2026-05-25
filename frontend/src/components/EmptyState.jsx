export default function EmptyState({ message = 'No results found' }) {
  return (
    <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#aaa' }}>
      <div style={{
        display: 'inline-block', width: 52, height: 52,
        border: '2.5px solid #ddd', borderRadius: '50%',
        position: 'relative', marginBottom: '0.85rem',
      }}>
        <div style={{
          position: 'absolute', top: '50%', left: '12%',
          width: '76%', height: '2.5px', background: '#ddd',
          transform: 'translateY(-50%) rotate(-45deg)',
        }} />
      </div>
      <p style={{ fontSize: '0.95rem', margin: 0, color: '#bbb' }}>{message}</p>
    </div>
  )
}
