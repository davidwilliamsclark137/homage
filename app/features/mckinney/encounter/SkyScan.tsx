import SkyScanner from '../../../sky/SkyScanner';
import { DOWNTOWN } from './skyGate';
export default function SkyScan(props: {test: boolean; active: boolean; onScan: (id: string)=>void}) {
 return <SkyScanner {...props} region={{center:DOWNTOWN,radiusMeters:1500}} />;
}
