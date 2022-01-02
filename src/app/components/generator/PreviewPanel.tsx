import type { DataModel } from '@mcschema/core'
import { Path } from '@mcschema/core'
import { useState } from 'preact/hooks'
import { useModel } from '../../hooks'
import type { VersionId } from '../../services'
import { BiomeSourcePreview, DecoratorPreview, NoisePreview, NoiseSettingsPreview } from '../previews'

export const HasPreview = ['dimension', 'worldgen/noise', 'worldgen/noise_settings', 'worldgen/configured_feature']

type PreviewPanelProps = {
	model: DataModel | null,
	version: VersionId,
	id: string,
	shown: boolean,
	onError: (message: string) => unknown,
}
export function PreviewPanel({ model, version, id, shown }: PreviewPanelProps) {
	const [, setCount] = useState(0)

	useModel(model, () => {
		setCount(count => count + 1)
	})

	if (id === 'dimension' && model?.get(new Path(['generator', 'type']))?.endsWith('noise')) {
		const data = model.get(new Path(['generator', 'biome_source']))
		if (data) return <BiomeSourcePreview {...{ model, version, shown, data }} />
	}

	if (id === 'worldgen/noise' && model) {
		const data = model.get(new Path([]))
		if (data) return <NoisePreview {...{ model, version, shown, data }} />
	}

	if (id === 'worldgen/noise_settings' && model) {
		const data = model.get(new Path([]))
		if (data) return <NoiseSettingsPreview {...{ model, version, shown, data }} />
	}

	if (id === 'worldgen/configured_feature' && model) {
		const data = model.get(new Path([]))
		if (data) return <DecoratorPreview {...{ model, version, shown, data }} />
	}

	return <></>
}
