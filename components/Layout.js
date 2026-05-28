import BottomNav from './BottomNav'
import styles from './Layout.module.css'

export default function Layout({ children, title, rightAction }) {
  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <h1 className={styles.title}>{title}</h1>
        {rightAction && <div>{rightAction}</div>}
      </header>
      <main className={styles.main}>
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
