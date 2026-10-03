/** STUB — coquille provisoire, remplacée par l'agent UI. */
import { CoursesScreen } from '../features/courses/CoursesScreen';
import { MaisonScreen } from '../features/maison/MaisonScreen';
import { WorldProvider, WorldStage } from '../world/WorldContext';

export function App() {
  return (
    <WorldProvider>
      <div className="app-shell">
        <WorldStage className="app-world" />
        <main className="app-main">
          <MaisonScreen />
          <CoursesScreen />
        </main>
      </div>
    </WorldProvider>
  );
}
