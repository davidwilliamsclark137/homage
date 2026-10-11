type Vector = {
    x: number;
    y: number;
    z: number;
};
export declare function cameraDirection(gravity: Vector, magnetic: Vector, declination: number): {
    heading: number;
    altitude: number;
    roll: number;
} | null;
export {};
