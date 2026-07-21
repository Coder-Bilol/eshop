import { AuthLogin } from "../../components/auth-login";
import { normalizeReturnPath } from "../../lib/auth";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps = {}) {
  const resolvedSearchParams = (await searchParams) || {};
  const returnPath = normalizeReturnPath(resolvedSearchParams.return_path);

  return <AuthLogin returnPath={returnPath} />;
}
