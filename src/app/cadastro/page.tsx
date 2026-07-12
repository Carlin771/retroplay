import { redirect } from "next/navigation";

// O cadastro público foi desativado: o acesso é criado pelo administrador.
// Qualquer visita a /cadastro é redirecionada para a tela de login.
export default function CadastroPage() {
  redirect("/login");
}
