import {SplineCard, CardLink} from "../SplineCard.js";
import {PreviewProps} from "./index.js";
import {CubicSpline, MinMaxNumberFunction} from "deepslate";
import {createContext} from "preact";
import fromJson = CubicSpline.fromJson;
import {useCallback, useMemo, useRef, useState} from "preact/hooks";
import {clamp, pos2n} from "../../Utils.js";
import {Btn} from "../Btn.js";
import {BtnMenu} from "../BtnMenu.js";
import {useLocale} from "../../contexts/index.js";

function checkSpline(data: any): boolean {
    if (typeof data === 'number')
        return true
    if (typeof data !== 'object')
        return false
    if (!('coordinate' in data) || !('points' in data))
        return false
    let coordType = typeof data.coordinate
    if (coordType != 'string' && coordType != 'number')
        return false
    if (!(data.points instanceof Array))
        return false
    return true
}

function checkPoint(point: any): boolean {
    if (!('node' in point))
        return false
    if (!('derivative' in point.node) || !('location' in point.node) || !('value' in point.node))
        return false
    if (typeof point.node.derivative !== 'number' || typeof point.node.location !== 'number')
        return false
    return checkSpline(point.node.value)
}

export class Coordinate {
    private value: number
    val() {return this.value}
    private minValue: number
    min() {return this.minValue}
    private maxValue: number
    max() {return this.maxValue}

    constructor() {
        this.value = 0
        this.minValue = -1
        this.maxValue = 1
    }

    setMin(val: number) {
        this.minValue = val
        this.value = Math.max(this.value, this.minValue)
        this.maxValue = Math.max(this.maxValue, this.minValue)
    }

    setMax(val: number) {
        this.maxValue = val
        this.value = Math.min(this.value, this.maxValue)
        this.minValue = Math.min(this.minValue, this.maxValue)
    }

    setValue(val: number) {
        val = clamp(val, this.minValue, this.maxValue)
        if (val == this.value)
            return false
        this.value = val
        return true
    }

    toExtractor(): MinMaxNumberFunction<number> {
        return {
            compute(c: number): number {
                return c
            },
            minValue(): number {
                return this.minValue()
            },
            maxValue(): number {
                return this.maxValue()
            }
        }
    }
}

export type CoordinateListener = (coordinate: Coordinate, redraw: boolean) => any

class CoordinateManager {
    listeners: Map<string, Set<CoordinateListener>>
    coordinates: Map<string, Coordinate>

    constructor() {
        this.listeners = new Map<string, Set<CoordinateListener>>()
        this.coordinates = new Map<string, Coordinate>()
    }

    addOrGetCoordinate(name: string): Coordinate {
        if (!this.coordinates.has(name))
            this.coordinates.set(name, new Coordinate())
        return this.coordinates.get(name)!
    }

    getCoordinate(name: string): Coordinate | undefined {
        return this.coordinates.get(name)
    }

    removeAllListeners() {
        this.listeners.clear()
    }

    removeListener(name: string, listener: CoordinateListener) {
        const set = this.listeners.get(name)
        if (!set)
            return
        set.delete(listener)
    }

    addListener(name: string, listener: CoordinateListener) {
        if (!this.listeners.has(name))
            this.listeners.set(name, new Set<CoordinateListener>())
        // I know ?. isn't required here, but my IDE keeps mumbling
        this.listeners.get(name)?.add(listener)
    }

    private emit(name: string, redraw: boolean) {
        const coordinate = this.coordinates.get(name)
        const set = this.listeners.get(name)
        if (!set || !coordinate)
            return
        for (const listener of set)
            listener(coordinate, redraw)
    }

    setValue(name: string, value: number) {
        if (this.coordinates.get(name)?.setValue(value))
            this.emit(name, false)
    }

    setMin(name: string, value: number) {
        const coordinate = this.coordinates.get(name)
        if (coordinate) {
            coordinate.setMin(value)
            this.emit(name, true)
        }
    }

    setMax(name: string, value: number) {
        const coordinate = this.coordinates.get(name)
        if (coordinate) {
            coordinate.setMax(value)
            this.emit(name, true)
        }
    }
}

export const Offset = createContext<pos2n>({x: 0, y: 0})
export const ShowCoordName = createContext<boolean>(true)
export const Manager = createContext<CoordinateManager | null>(null)

export function genCardLinkColor() {
    let hue = Math.floor(Math.random() * 360)
    let saturation = Math.round(Math.random() * 50) + 50
    let lightness = Math.round(Math.random() * 30) + 50
    return `hsl(${hue}, ${saturation}%, ${lightness}%`
}

// TODO More careful type check, or check if such check is necessary

export const SplinePreview = ({data}: PreviewProps) => {
    console.log(data)
    const {locale} = useLocale()

    const [offset, setOffset] = useState({x: 0, y: 0})
    const [focused, setFocused] = useState<string[]>([])
    const [showCoordName, setShowCoordName] = useState<boolean>(true)
    const offsetRef = useRef<pos2n>(offset)
    const managerRef = useRef<CoordinateManager>(new CoordinateManager())

    function build(data: any, outputLink: CardLink | null, placePos: pos2n):
        { elements: JSX.Element[], defaultVal: number, height: number } {
        const INDENT = 10
        // Keep it matched with CSS height of spline-card in global.css
        const DEFAULT_CARD_HEIGHT = 120
        let result: JSX.Element[] = []
        if (!checkSpline(data))
            return {elements: result, defaultVal: 0, height: 0}
        let totHeight = INDENT + DEFAULT_CARD_HEIGHT
        if (typeof data == 'number') {
            const coordinate = new Coordinate()
            coordinate.setMax(data)
            coordinate.setMin(data)
            return {
                elements: [
                    <SplineCard
                        spline={fromJson(data, coordinate.toExtractor)}
                        coordinate={data}
                        inputLinkList={[]}
                        outputLink={outputLink}
                        placePos={{x: placePos.x + INDENT, y: placePos.y + INDENT}}
                        setFocused={setFocused}/>
                ],
                defaultVal: data,
                height: totHeight
            }
        }
        const spline = {
            coordinate: data.coordinate,
            points: Array<{ derivative: number, location: number, value: number }>(0)
        }
        let inputLinkList: CardLink[] = []
        for (let i = 0; i < data.points.length; i++) {
            const point = data.points[i]
            if (!checkPoint(point))
                continue

            if (typeof point.node.value === 'number')
                spline.points.push(point.node)
            else {
                const inputLink: CardLink = {
                    valIndex: i,
                    color: genCardLinkColor(),
                    handleValueChange: null,
                    handleColorChange: null
                }
                let buildResult = build(
                    point.node.value,
                    inputLink,
                    {x: placePos.x + INDENT, y: placePos.y + totHeight}
                )
                totHeight += buildResult.height
                spline.points.push({
                    derivative: point.node.derivative,
                    location: point.node.location,
                    value: buildResult.elements.length > 0 ? buildResult.defaultVal : 0
                })
                result = [...result, ...buildResult.elements]
                inputLinkList = [...inputLinkList, inputLink]
            }
        }
        const coordName = typeof spline.coordinate == 'object' ?
            `Inline${Math.floor(Math.random()*100000000)}` :
            `${spline.coordinate}`
        const coordinate = managerRef.current.addOrGetCoordinate(coordName)
        const cubicSpline = fromJson(spline, coordinate.toExtractor)
        result = [...result, <SplineCard
            coordinate={spline.coordinate}
            spline={cubicSpline}
            inputLinkList={inputLinkList}
            outputLink={outputLink}
            placePos={{x: placePos.x + INDENT, y: placePos.y + INDENT}}
            setFocused={setFocused}
        />]


        return {elements: result, defaultVal: cubicSpline.compute(coordinate.val()), height: totHeight}
    }

    const {elements: cards} = useMemo(() => build(data, null, {x: 0, y: 0}), [data])

    function onMouseUp(e: MouseEvent) {
        if (e.button != 0)
            return
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
    }

    function onMouseMove(e: MouseEvent) {
        setOffset(offsetRef.current = {
            x: offsetRef.current.x + e.movementX,
            y: offsetRef.current.y + e.movementY
        })
    }

    const onMouseDown = useCallback((e: MouseEvent) => {
        if (e.button != 0)
            return
        document.addEventListener('mousemove', onMouseMove)
        document.addEventListener('mouseup', onMouseUp)
    }, [])

    // TODO solve situation where passed in Json is...just a constant
    return <>
        <div class="controls preview-controls">
            {focused.map(s => <Btn label={s} class="no-pointer"/>)}
            <BtnMenu icon="gear" tooltip={locale('settings')}>
                <Btn icon={showCoordName ? 'square_fill' : 'square'} label={locale('preview.show_coord_name')}
                     onClick={() => setShowCoordName(!showCoordName)}/>
            </BtnMenu>
            <BtnMenu icon={'code'}>

            </BtnMenu>
        </div>
        <div class="full-preview">
            <div class="spline-preview" onMouseDown={onMouseDown}>
                <Offset.Provider value={offset}>
                    <ShowCoordName.Provider value={showCoordName}>
                        <Manager.Provider value={managerRef.current}>
                            {cards}
                        </Manager.Provider>
                    </ShowCoordName.Provider>
                </Offset.Provider>
            </div>
        </div>
    </>
}