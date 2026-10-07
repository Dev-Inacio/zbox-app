package com.zbox.backend.service;

import com.zbox.backend.dto.AuthUser;
import com.zbox.backend.dto.LoginRequest;
import com.zbox.backend.dto.LoginResponse;
import com.zbox.backend.model.Usuario;
import com.zbox.backend.security.JwtService;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final AuthenticationManager authenticationManager;

    private final JwtService jwtService;

    private final UsuarioService usuarioService;

    public AuthService(AuthenticationManager authenticationManager, JwtService jwtService, UsuarioService usuarioService) {
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.usuarioService = usuarioService;
    }

    public LoginResponse login(LoginRequest loginRequest) {
        authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(loginRequest.getEmail(), loginRequest.getPassword()));

        Usuario usuario = usuarioService.buscarPorUsuario(loginRequest.getEmail());

        String token = jwtService.gerarToken(usuario.getUsuario());

        AuthUser authUser = new AuthUser(usuario.getId(), usuario.getName(), usuario.getUsuario(), usuario.getRole().name());

        return new LoginResponse(token, "Bearer", jwtService.getExpiracaoSegundos(), authUser);
    }
}
