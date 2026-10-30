export async function register() {
  if (!process.env.DATABASE_URL) return;
  try {
    const { initDb } = await import('@/lib/db');
    await initDb();
  } catch (error) {
    console.error('Не удалось инициализировать схему БД', error);
  }
}
