import { HOUSES, HOUSE_ORDER } from "../config/houses";

export default function TestHouses() {
    return (
        <div className="p-10">
            <h1 className="text-2xl font-bold mb-4">House Config Test</h1>
            <pre className="bg-slate-100 p-4 rounded">
                {JSON.stringify({ HOUSES, HOUSE_ORDER }, null, 2)}
            </pre>
        </div>
    );
}
