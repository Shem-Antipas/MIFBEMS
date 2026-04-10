import AppRouter from "@/router";
import { useAuth } from "@/hooks/useAuth";

const App = () => {
  useAuth();
  return <AppRouter />;
};

export default App;
