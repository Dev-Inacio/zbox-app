package com.zbox.backend.config;

import com.zbox.backend.model.Usuario;
import com.zbox.backend.service.UsuarioService;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class UsuarioDetailsService implements UserDetailsService {

    private final UsuarioService usuarioService;

    public UsuarioDetailsService(UsuarioService usuarioService) {
        this.usuarioService = usuarioService;
    }


    @Override
    public UserDetails loadUserByUsername(String usuario) throws UsernameNotFoundException {
        try {
            Usuario buscarUsuario = usuarioService.buscarPorUsuario(usuario);

            return User.builder()
                    .username(buscarUsuario.getUsuario())
                    .password(buscarUsuario.getSenha())
                    .authorities("ROLE_ADMIN")
                    .build();
        }catch (RuntimeException exception){
            throw new UsernameNotFoundException(exception.getMessage());
        }
    }
}
