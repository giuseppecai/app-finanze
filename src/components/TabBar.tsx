import { NavLink } from 'react-router-dom';
import { routes } from '../app/routes';
import { it } from '../i18n/it';
import { IconChart, IconEnvelopes, IconList, IconPlus, IconSettings } from './icons';

export function TabBar() {
  return (
    <nav className="tabbar" aria-label={it.nav.main}>
      <NavLink to={routes.home} end className="tabbar__item">
        <IconEnvelopes />
        {it.tabs.envelopes}
      </NavLink>
      <NavLink to={routes.movements} className="tabbar__item">
        <IconList />
        {it.tabs.movements}
      </NavLink>
      <NavLink to={routes.entry} className="tabbar__add" aria-label={it.tabs.add}>
        <IconPlus />
      </NavLink>
      <NavLink to={routes.history} className="tabbar__item">
        <IconChart />
        {it.tabs.history}
      </NavLink>
      <NavLink to={routes.settings} className="tabbar__item">
        <IconSettings />
        {it.tabs.settings}
      </NavLink>
    </nav>
  );
}
