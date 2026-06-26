import { useRouter } from 'next/router'
import { useAuth } from '../lib/useAuth'
import styles from './BottomNav.module.css'

const navItems = [
  { href: '/', icon: 'ti-home', label: '홈' },
  { href: '/register', icon: 'ti-plus', label: '등록' },
  { href: '/my-records', icon: 'ti-notebook', label: '내기록' },
  { href: '/list', icon: 'ti-list', label: '조회' },
  { href: '/ranking', icon: 'ti-trophy', label: '랭킹' },
]

const ceoItems = [
  { href: '/eval', icon: 'ti-star', label: '평가' },
  { href: '/report', icon: 'ti-download', label: '보고서' },
]

export default function BottomNav() {
  const router = useRouter()
  const { isCeo } = useAuth()
  const items = isCeo ? [...navItems, ...ceoItems] : navItems

  return (
    <nav className={styles.nav}>
      {items.map(item => (
        <button
          key={item.href}
          className={`${styles.item} ${router.pathname === item.href ? styles.active : ''}`}
          onClick={() => router.push(item.href)}
        >
          <i className={`ti ${item.icon}`} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
