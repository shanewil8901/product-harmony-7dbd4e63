import Barcode from 'react-barcode';

interface Props {
  value?: string | null;
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
}

function isValidEan13(v: string): boolean {
  if (!/^\d{13}$/.test(v)) return false;
  const digits = v.split('').map(Number);
  const check = digits.pop()!;
  const sum = digits.reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0);
  const calc = (10 - (sum % 10)) % 10;
  return calc === check;
}

export function ProductBarcode({
  value,
  width = 2,
  height = 80,
  displayValue = true,
  fontSize = 14,
}: Props) {
  if (!value || !isValidEan13(value)) {
    return (
      <span className="inline-flex items-center rounded-md border border-brown-200 bg-paper-warm px-2 py-1 text-xs text-brown-500">
        No Barcode
      </span>
    );
  }
  return (
    <div className="inline-flex flex-col items-center bg-white p-2 rounded-md">
      <Barcode
        value={value}
        format="EAN13"
        displayValue={displayValue}
        width={width}
        height={height}
        fontSize={fontSize}
        background="#ffffff"
        lineColor="#000000"
        margin={0}
      />
    </div>
  );
}
