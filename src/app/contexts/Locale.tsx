import type { ComponentChildren } from 'preact'
import { createContext } from 'preact'
import { useCallback, useContext, useEffect, useState } from 'preact/hooks'
import config from '../../config.json'
import English from '../../locales/en.json'
import { Analytics } from '../Analytics'
import { Store } from '../Store'

interface Locale {
	lang: string,
	locale: (key: string, ...params: string[]) => string,
	changeLanguage: (lang: string) => unknown,
}
const Locale = createContext<Locale>({
	lang: 'none',
	locale: key => key,
	changeLanguage: () => {},
})

export const Locales: {
	[key: string]: {
		[key: string]: string,
	},
} = {
	fallback: English,
}

export function localize(lang: string, key: string, ...params: string[]) {
	const value: string | undefined = Locales[lang]?.[key]
	?? Locales.en?.[key] ?? Locales.fallback[key] ?? key
	return resolveLocaleParams(value, params)
}

function resolveLocaleParams(value: string, params?: string[]): string {
	return value.replace(/%\d+%/g, match => {
		const index = parseInt(match.slice(1, -1))
		return params?.[index] !== undefined ? params[index] : match
	})
}

async function loadLocale(language: string) {
	if (Locales[language]) return
	const langConfig = config.languages.find(lang => lang.code === language)
	if (!langConfig) return
	const data = await import(`../../locales/${language}.json`)
	const schema = langConfig.schemas !== false
		&& await import(`../../../node_modules/@mcschema/locales/src/${language}.json`)
	Locales[language] = { ...data.default, ...schema.default }
}

export function useLocale() {
	return useContext(Locale)
}

export function LocaleProvider({ children }: { children: ComponentChildren }) {
	const [lang, setLanguage] = useState('none')

	const locale = useCallback((key: string, ...params: string[]) => {
		return localize(lang, key, ...params)
	}, [lang])

	const changeLanguage = useCallback(async (lang: string) => {
		await loadLocale(lang)
		Analytics.setLanguage(lang)
		Store.setLanguage(lang)
		setLanguage(lang)
	}, [])

	useEffect(() => {
		(async () => {
			const target = Store.getLanguage()
			await Promise.all([
				loadLocale('en'),
				...(target !== 'en' ? [loadLocale(target)] : []),
			])
			setLanguage(target)
		})()
	}, [])

	const value: Locale = {
		lang,
		locale: locale,
		changeLanguage,
	}

	return <Locale.Provider value={value}>
		{children}
	</Locale.Provider>
}
