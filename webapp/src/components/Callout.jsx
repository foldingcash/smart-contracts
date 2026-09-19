export default function Callout({ tone = 'info', children }) {
    return <div className={`callout callout-${tone}`}>{children}</div>;
}
