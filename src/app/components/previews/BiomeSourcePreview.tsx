import { Path } from '@mcschema/core'
import type { NoiseParameters } from 'deepslate/worldgen'
import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { useLocale, useStore } from '../../contexts/index.js'
import { useCanvas } from '../../hooks/index.js'
import { biomeMap, getBiome } from '../../previews/index.js'
import { newSeed, randomSeed } from '../../Utils.js'
import { Btn, BtnMenu } from '../index.js'
import type { PreviewProps } from './index.js'

const LAYERS = ['biomes', 'temperature', 'humidity', 'continentalness', 'erosion', 'weirdness'] as const

export const BiomeSourcePreview = ({ model, data, shown, version }: PreviewProps) => {
	const { locale } = useLocale()
	const [configuredSeed] = useState(randomSeed())
	const [scale, setScale] = useState(2)
	const [focused, setFocused] = useState<{[k: string]: number | string} | undefined>(undefined)
	const [layers, setLayers] = useState(new Set<typeof LAYERS[number]>(['biomes']))
	const { biomeColors } = useStore()
	const offset = useRef<[number, number]>([0, 0])
	const res = useRef(1)
	const refineTimeout = useRef<number>()

	const seed = BigInt(model.get(new Path(['generator', 'seed'])) ?? configuredSeed)
	const octaves = useMemo(() => {
		if (!shown) return undefined
		return getOctaves(model.get(new Path(['generator', 'settings'])))
	}, [shown])
	const state = shown ? calculateState(data, octaves!) : ''
	const type: string = data.type?.replace(/^minecraft:/, '')

	const { canvas, redraw } = useCanvas({
		size() {
			return [200 / res.current, 200 / res.current]
		},
		async draw(img) {
			const options = { octaves: octaves!, biomeColors, layers, offset: offset.current, scale, seed, res: res.current, version }
			await biomeMap(data, img, options)
			if (res.current === 4) {
				clearTimeout(refineTimeout.current)
				refineTimeout.current = setTimeout(() => {
					res.current = 1
					redraw()
				}, 150) as any
			}
		},
		async onDrag(dx, dy) {
			offset.current[0] = offset.current[0] + dx * 200
			offset.current[1] = offset.current[1] + dy * 200
			clearTimeout(refineTimeout.current)
			res.current = type === 'multi_noise' ? 4 : 1
			redraw()
		},
		async onHover(x, y) {
			const options = { octaves: octaves!, biomeColors, layers, offset: offset.current, scale, seed: configuredSeed, res: 1, version }
			const biome = await getBiome(data, Math.floor(x * 200), Math.floor(y * 200), options)
			setFocused(biome)
		},
		onLeave() {
			setFocused(undefined)
		},
	}, [version, state, scale, configuredSeed, layers, biomeColors])

	useEffect(() => {
		if (shown) {
			res.current = type === 'multi_noise' ? 4 : 1
			redraw()
		}
	}, [version, state, scale, configuredSeed, layers, shown, biomeColors])

	const changeScale = (newScale: number) => {
		offset.current[0] = offset.current[0] * scale / newScale
		offset.current[1] = offset.current[1] * scale / newScale
		setScale(newScale)
	}

	return <>
		<div class="controls preview-controls">
			{focused && <Btn label={focused.biome as string} class="no-pointer" />}
			{type === 'multi_noise' &&
				<BtnMenu icon="stack" tooltip={locale('configure_layers')}>
					{LAYERS.map(name => {
						const enabled = layers.has(name)
						return <Btn label={locale(`layer.${name}`)} 
							active={enabled}
							tooltip={enabled ? locale('enabled') : locale('disabled')}
							onClick={(e) => {
								setLayers(new Set([name]))
								e.stopPropagation()
							}} />
					})}
				</BtnMenu>}
			{(type === 'multi_noise' || type === 'checkerboard') && <>
				<Btn icon="dash" tooltip={locale('zoom_out')}
					onClick={() => changeScale(scale * 1.5)} />
				<Btn icon="plus" tooltip={locale('zoom_in')}
					onClick={() => changeScale(scale / 1.5)} />
			</>}
			{type === 'multi_noise' &&
				<Btn icon="sync" tooltip={locale('generate_new_seed')}
					onClick={() => newSeed(model)} />}
		</div>
		{focused?.temperature !== undefined && <div class="controls secondary-controls">
			<Btn class="no-pointer" label={Object.entries(focused)
				.filter(([k]) => k !== 'biome')
				.map(([k, v]) => `${k[0].toUpperCase()}: ${(v as number).toFixed(2)}`).join('  ')}/>
		</div>}
		<canvas ref={canvas} width="200" height="200"></canvas>
	</>
}

function calculateState(data: any, octaves: Record<string, NoiseParameters>) {
	return JSON.stringify([data, octaves])
}

export function getOctaves(obj: any): Record<string, NoiseParameters> {
	if (typeof obj !== 'string') {
		obj = obj.legacy_random_source ? 'minecraft:nether' : 'minecraft:overworld'
	}
	switch (obj.replace(/^minecraft:/, '')) {
		case 'overworld':
		case 'amplified':
			return {
				temperature: { firstOctave: -9, amplitudes: [1.5, 0, 1, 0, 0, 0] },
				humidity: { firstOctave: -7, amplitudes: [1, 1, 0, 0, 0, 0] },
				continentalness: { firstOctave: -9, amplitudes: [1, 1, 2, 2, 2, 1, 1, 1, 1] },
				erosion: { firstOctave: -9, amplitudes: [1, 1, 0, 1, 1] },
				weirdness: { firstOctave: -7, amplitudes: [1, 2, 1, 0, 0, 0] },
				shift: { firstOctave: -3, amplitudes: [1, 1, 1, 0] },
			}
		case 'large_biomes':
			return {
				temperature: { firstOctave: -12, amplitudes: [1.5, 0, 1, 0, 0, 0] },
				humidity: { firstOctave: -10, amplitudes: [1, 1, 0, 0, 0, 0] },
				continentalness: { firstOctave: -11, amplitudes: [1, 1, 2, 2, 2, 1, 1, 1, 1] },
				erosion: { firstOctave: -11, amplitudes: [1, 1, 0, 1, 1] },
				weirdness: { firstOctave: -7, amplitudes: [1, 2, 1, 0, 0, 0] },
				shift: { firstOctave: -3, amplitudes: [1, 1, 1, 0] },
			}
		default:
			return {
				temperature: { firstOctave: -7, amplitudes: [1, 1] },
				humidity: { firstOctave: -7, amplitudes: [1, 1] },
				continentalness: { firstOctave: -7, amplitudes: [1, 1] },
				erosion: { firstOctave: -7, amplitudes: [1, 1] },
				weirdness: { firstOctave: -7, amplitudes: [1, 1] },
				shift: { firstOctave: 0, amplitudes: [0] },
			}
	}
}
