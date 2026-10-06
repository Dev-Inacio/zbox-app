package com.zbox.backend.service;

import com.zbox.backend.model.Usuario;
import com.zbox.backend.repository.UsuarioRepository;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class UsuarioService {

    private final UsuarioRepository usuarioRepository;

    public UsuarioService(UsuarioRepository usuarioRepository) {
        this.usuarioRepository = usuarioRepository;
    }

    public Usuario buscarPorUsuario(String usuario) {
        return usuarioRepository.findByUsuario(usuario)
                .orElseThrow(() -> new UsernameNotFoundException("Usuário Não Existe"));
    }
}
