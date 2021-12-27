import { render } from 'preact'
import type { RouterOnChangeArgs } from 'preact-router'
import { getCurrentUrl, Router } from 'preact-router'
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks'
import config from '../config.json'
import '../styles/global.css'
import '../styles/nodes.css'
import { Analytics } from './Analytics'
import { Header } from './components'
import { loadLocale, locale, Locales } from './Locales'
import { Category, Changelog, Generator, Home, Sounds } from './pages'
import type { VersionId } from './services'
import { getProject, VersionIds } from './services'
import { Store } from './Store'
import { cleanUrl, getSearchParams, setSeachParams } from './Utils'

const VERSIONS_IN_TITLE = 3

function Main() {
	const [lang, setLanguage] = useState<string>('none')
	const changeLanguage = async (language: string) => {
		if (!Locales[language]) {
			await loadLocale(language)
		}
		Analytics.setLanguage(language)
		Store.setLanguage(language)
		setLanguage(language)
	}
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

	const [theme, setTheme] = useState<string>(Store.getTheme())
	const changeTheme = (theme: string) => {
		Analytics.setTheme(theme)
		Store.setTheme(theme)
		setTheme(theme)
	}
	useEffect(() => {
		document.documentElement.setAttribute('data-theme', theme)
	}, [theme])

	const searchParams = getSearchParams(getCurrentUrl())
	const targetVersion = searchParams.get('version')
	const [version, setVersion] = useState<VersionId>(Store.getVersion())
	const changeVersion = useCallback((version: VersionId) => {
		if (getSearchParams(getCurrentUrl()).has('version')) {
			setSeachParams({ version })
		}
		Analytics.setVersion(version)
		Store.setVersion(version)
		setVersion(version)
	}, [targetVersion])
	useEffect(() => {
		if (VersionIds.includes(targetVersion as VersionId) && version !== targetVersion) {
			setVersion(targetVersion as VersionId)
		}
	}, [version, targetVersion])

	const [projectName, _setProject] = useState<string>('Drafts')
	const project = useMemo(() => {
		return getProject(projectName) ?? getProject('Drafts')!
	}, [projectName])

	const [title, setTitle] = useState<string>(locale(lang, 'title.home'))
	const changeTitle = (title: string, versions?: VersionId[]) => {
		versions ??= config.versions.map(v => v.id as VersionId)
		const titleVersions = versions.slice(versions.length - VERSIONS_IN_TITLE)
		document.title = `${title} Minecraft ${titleVersions.join(', ')}`
		setTitle(title)
	}

	const changeRoute = (e: RouterOnChangeArgs) => {
		// Needs a timeout to ensure the title is set correctly
		setTimeout(() => Analytics.pageview(cleanUrl(e.url)))
	}

	return <>
		<Header {...{lang, title, version, theme, language: lang, changeLanguage, changeTheme}} />
		<Router onChange={changeRoute}>
			<Home path="/" {...{lang, changeTitle}} />
			<Category path="/worldgen" category="worldgen" {...{lang, changeTitle}} />
			<Category path="/assets" category="assets" {...{lang, changeTitle}} />
			<Sounds path="/sounds" {...{lang, version, changeTitle, changeVersion}} />
			<Changelog path="/changelog" {...{lang, changeTitle}} />
			<Generator default {...{lang, version, changeTitle, changeVersion, project}} />
		</Router>
	</>
}

render(<Main />, document.body)
