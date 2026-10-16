// The title and one-line description at the top of every admin page.
export default function Header({ title, description }: { title: string; description: string }) {
    return (
        <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{title}</h1>
            <p className="text-sm text-neutral-500">{description}</p>
        </div>
    );
}
